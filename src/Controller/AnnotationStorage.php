<?php

namespace Drupal\recogito_integration\Controller;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\node\Entity\Node;
use Drupal\taxonomy\Entity\Term;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for Recogito JS operations on annotations and related content.
 */
class AnnotationStorage extends ControllerBase {

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * The config factory.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected $configFactory;

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The entity field manager.
   *
   * @var \Drupal\Core\Entity\EntityFieldManagerInterface
   */
  protected $entityFieldManager;

  /**
   * Constructs a new Annotation Storage Controller.
   *
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The config factory.
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Entity\EntityFieldManagerInterface $entity_field_manager
   *   The entity field manager.
   */
  public function __construct(
    AccountProxyInterface $current_user,
    ConfigFactoryInterface $config_factory,
    EntityTypeManagerInterface $entity_type_manager,
    EntityFieldManagerInterface $entity_field_manager) {
    $this->currentUser = $current_user;
    $this->configFactory = $config_factory;
    $this->entityTypeManager = $entity_type_manager;
    $this->entityFieldManager = $entity_field_manager;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('current_user'),
      $container->get('config.factory'),
      $container->get('entity_type.manager'),
      $container->get('entity_field.manager')
    );
  }

  /**
   * Constructs the style for an annotation based on its tags.
   *
   * @param array $tags
   *   The tags associated with the annotation.
   *
   * @return array
   *   The style for the annotation.
   */
  public function constructStyle(array $tags) {
    $config = $this->configFactory->get('recogito_integration.settings');
    $style = [
      'text_color' => $config->get('recogito_integration.text_color') ?? '#000000',
      'background_color' => $config->get('recogito_integration.background_color') ?? '#000000',
      'underline_color' => $config->get('recogito_integration.underline_color') ?? '#000000',
      'underline_style' => $config->get('recogito_integration.underline_style') ?? 'none',
      'underline_stroke' => $config->get('recogito_integration.underline_stroke') ?? '0',
      'background_transparency' => $config->get('recogito_integration.background_transparency') ?? '0',
    ];
    if (!$tags) {
      return $style;
    }
    $style_field = [];
    $min = reset($tags);
    foreach ($tags as $tag) {
      $vocabulary = $tag->bundle();
      if (!isset($style_field[$vocabulary])) {
        $field_definitions = $this->entityFieldManager->getFieldDefinitions('taxonomy_term', $vocabulary);
        foreach ($field_definitions as $field_name => $field_definition) {
          if ($field_definition->getType() === 'annotation_profile') {
            $style_field[$vocabulary] = $field_name;
            break;
          }
        }
        if (!isset($style_field[$vocabulary])) {
          $style_field[$vocabulary] = '';
        }
      }
      if (empty($style_field[$vocabulary])) {
        continue;
      }
      $min_field = $style_field[$min->bundle()];
      $tag_field = $style_field[$vocabulary];

      $min_style = $min->get($min_field)->getValue();
      $tag_style = $tag->get($tag_field)->getValue();
      if (empty($min_style) || isset($tag_style) && $min_style[0]['styling_choice'] == '0') {
        $min = $tag;
      }
      elseif (!empty($tag_style) && $tag_style[0]['styling_choice'] == '1' && $tag_style[0]['styling_weight'] < $min_style[0]['styling_weight']) {
        $min = $tag;
      }
    }
    $min_field = $style_field[$min->bundle()];
    if (empty($min_field)) {
      return $style;
    }
    $min_style = $min->get($min_field)->getValue();
    if (!empty($min_style) && $min_style[0]['styling_choice'] == '1') {
      $style = [
        'text_color' => $min_style[0]['text_color'],
        'background_color' => $min_style[0]['background_color'],
        'underline_style' => $min_style[0]['underline_style'],
        'underline_stroke' => $min_style[0]['underline_stroke'],
        'underline_color' => $min_style[0]['underline_color'],
        'background_transparency' => $min_style[0]['background_transparency'],
      ];
    }
    return $style;
  }

  /**
   * Retrieves annotations for a given page URL (URL in header).
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response containing the annotations.
   */
  public function getAnnotations(Request $request) {
    $user = $this->currentUser;
    if (!$user->hasPermission('recogito view annotations')) {
      return new JsonResponse('Insufficient permissions - User cannot view annotations.', 403);
    }
    $pageUrl = $request->headers->get('pageurl');
    $collectionNode = self::queryAnnotationCollectionNode($pageUrl);
    if (!$collectionNode) {
      return new JsonResponse(json_encode([]), 200);
    }
    $annotationData = [];
    $annotations = $collectionNode->get('field_annotation_reference')->referencedEntities();
    foreach ($annotations as $annotation) {
      $textualbodies = [];
      $tags = [];
      $textualbodyNodes = $annotation->get('field_annotation_textualbodies')->referencedEntities();
      foreach ($textualbodyNodes as $textualbody) {
        $bodyContent = [
          'created' => $textualbody->get('field_annotation_created')->getString(),
          'creator' => [
            'id' => $textualbody->get('field_annotation_creator_id')->getString(),
            'name' => $textualbody->get('field_annotation_creator_name')->getString(),
          ],
          'modified' => $textualbody->get('field_annotation_modified')->getString(),
          'purpose' => $textualbody->get('field_annotation_purpose')->getString(),
        ];
        if ($textualbody->get('field_annotation_purpose')->getString() === 'tagging') {
          $terms = $textualbody->get('field_annotation_tag_reference')->referencedEntities();
          $tag = reset($terms);
          if ($terms) {
            $tags[] = $tag;
            $bodyContent['value'] = $tag->getName();
          }
        }
        else {
          $bodyContent['value'] = $textualbody->get('field_annotation_value')->getString();
        }
        $textualbodies[] = $bodyContent;
      }
      $style = self::constructStyle($tags);
      $data = [
        'id' => $annotation->get('field_annotation_id')->getString(),
        'textualbodies' => $textualbodies,
        'target_element' => $annotation->get('field_annotation_target_element')->getString(),
        'type' => $annotation->get('field_annotation_type')->getString(),
      ];
      switch ($data['type']) {
        case 'Selection':
          $data['image_source'] = $annotation->get('field_annotation_image_source')->getString();
          $data['image_value'] = $annotation->get('field_annotation_image_value')->getString();
          break;

        case 'Annotation':
          $data['target_end'] = $annotation->get('field_annotation_target_end')->getString();
          $data['target_exact'] = $annotation->get('field_annotation_target_exact')->getString();
          $data['target_start'] = $annotation->get('field_annotation_target_start')->getString();
          $data['style'] = $style;
          break;
      }
      $annotationData[] = $data;
    }
    return new JsonResponse(json_encode($annotationData), 200);
  }

  /**
   * Creates an annotation based on the request body.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response containing the status of the operation.
   */
  public function createAnnotation(Request $request) {
    $user = $this->currentUser;
    if (!$user->hasPermission('recogito create annotations')) {
      return new JsonResponse('Insufficient permissions - User cannot create annotations.', 403);
    }
    $config = $this->configFactory->get('recogito_integration.settings');
    $vocabulary = $config->get('recogito_integration.vocabulary_name');
    if (!$vocabulary) {
      return new JsonResponse('Unable to create annotation due to vocabulary name not set! Please select a vocabulary name in the recogito integration settings for tagging purposes!', 500);
    }
    $vocabulary_entity = $this->entityTypeManager->getStorage('taxonomy_vocabulary')->load($vocabulary);
    if (!$vocabulary_entity) {
      return new JsonResponse('Unable to create annotation due to vocabulary not found! Please select a valid vocabulary in the recogito integration settings for tagging purposes!', 500);
    }
    $body = json_decode($request->getContent(), TRUE);
    $pageUrl = $body['pageUrl'];
    $annotationNode = self::createAnnotationNode($body);
    $collectionNode = self::queryAnnotationCollectionNode($pageUrl);
    if (!$collectionNode) {
      $collectionNode = self::createAnnotationCollectionNode($pageUrl);
    }
    self::addAnnotationToCollection($annotationNode, $collectionNode);
    return new JsonResponse('Annotation created successfully.', 200);
  }

  /**
   * Updates an annotation based on the request body.
   *
   * @param string $annotation_id
   *   The ID of the annotation to update.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response containing the status of the operation.
   */
  public function updateAnnotation(string $annotation_id, Request $request) {
    $annotation_id = '#' . $annotation_id;
    $node = self::queryAnnotationNode($annotation_id);
    if (!$node) {
      return new JsonResponse('Annotation not found.', 404);
    }
    $user = $this->currentUser;
    $body = json_decode($request->getContent(), TRUE);
    $editable = $user->hasPermission('recogito edit annotations') || ($user->hasPermission('recogito edit own annotations') && $node->getOwnerId() === $user->id);
    if (!$editable) {
      return new JsonResponse('Insufficient permissions - User cannot edit this annotation.', 403);
    }
    self::updateAnnotationNode($body, $node);
    return new JsonResponse('Successfully updated annotation!', 200);
  }

  /**
   * Deletes an annotation based on the request body.
   *
   * @param string $annotation_id
   *   The ID of the annotation to delete.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response containing the status of the operation.
   */
  public function deleteAnnotation(string $annotation_id, Request $request) {
    $annotation_id = '#' . $annotation_id;
    $node = self::queryAnnotationNode($annotation_id);
    if (!$node) {
      return new JsonResponse('Annotation not found.', 404);
    }
    $user = $this->currentUser;
    $deletable = $user->hasPermission('recogito delete annotations') || ($user->hasPermission('recogito delete own annotations') && $node->getOwnerId() === $user->id);
    if (!$deletable) {
      return new JsonResponse('Insufficient permissions - User cannot delete this annotation.', 403);
    }
    self::deleteTextualbody($node);
    $node->delete();
    return new JsonResponse('Successfully deleted annotation!', 200);
  }

  /**
   * Creates a new annotation collection node.
   *
   * @param string $pageUrl
   *   The URL of the page to which the annotations belong.
   *
   * @return \Drupal\node\Entity\Node
   *   The newly created annotation collection node.
   */
  public function createAnnotationCollectionNode(string $pageUrl) {
    $params = [
      'type' => 'annotation_collection',
      'langcode' => 'en',
      'created' => time(),
      'changed' => time(),
      'uid' => $this->currentUser->id(),
      'moderation_state' => 'published',
      'title' => 'Annotations for: ' . $pageUrl,
      'field_annotation_reference' => [],
      'field_annotation_collection_url' => $pageUrl,
    ];
    $node = Node::create($params);
    $node->save();
    return $node;
  }

  /**
   * Queries the annotation node based on the annotation ID.
   *
   * @param string $annotationId
   *   The ID of the annotation.
   *
   * @return \Drupal\node\Entity\Node
   *   The annotation node.
   */
  public function queryAnnotationNode(string $annotationId) {
    $annotations = $this->entityTypeManager
      ->getStorage('node')
      ->loadByProperties([
        'type' => 'annotation',
        'field_annotation_id' => $annotationId,
        'status' => 1,
      ]);
    return reset($annotations);
  }

  /**
   * Adds an annotation to an annotation collection node.
   *
   * @param \Drupal\node\Entity\Node $annotationNode
   *   The annotation node.
   * @param \Drupal\node\Entity\Node $collectionNode
   *   The collection node.
   */
  public function addAnnotationToCollection(Node $annotationNode, Node $collectionNode) {
    if (!isset($collectionNode)) {
      return;
    }
    $collectionNode->set('changed', time());
    $collectionNode->field_annotation_reference[] = $annotationNode->id();
    $collectionNode->save();
    if (!isset($annotationNode)) {
      return;
    }
    $annotationNode->set('changed', time());
    $annotationNode->field_annotation_page[] = $collectionNode->id();
    $annotationNode->save();
  }

  /**
   * Queries the annotation collection node based on the page URL.
   *
   * @param string $pageUrl
   *   The URL of the page.
   *
   * @return \Drupal\node\Entity\Node
   *   The annotation collection node.
   */
  public function queryAnnotationCollectionNode(string $pageUrl) {
    $collectionNodes = $this->entityTypeManager
      ->getStorage('node')
      ->loadByProperties([
        'type' => 'annotation_collection',
        'field_annotation_collection_url' => $pageUrl,
        'status' => 1,
      ]);
    return reset($collectionNodes);
  }

  /**
   * Creates a textual body node for an annotation.
   *
   * @param array $textualbody
   *   The textual body data.
   * @param int $nodeId
   *   The ID of the annotation node.
   *
   * @return int
   *   The ID of the textual body node.
   */
  public function createTextualbodyNode(array $textualbody, int $nodeId) {
    $params = [
      'type' => 'annotation_textualbody',
      'langcode' => 'en',
      'created' => time(),
      'changed' => time(),
      'uid' => $this->currentUser->id(),
      'moderation_state' => 'published',
      'title' => (strlen($textualbody['value']) > 255) ? substr($textualbody['value'], 0, 255) : $textualbody['value'],
      'field_annotation_purpose' => $textualbody['purpose'],
      'field_annotation_created' => $textualbody['created'],
      'field_annotation_modified' => $textualbody['modified'],
      'field_annotation_target' => $nodeId,
      'field_annotation_creator_id' => $textualbody['creator']['id'],
      'field_annotation_creator_name' => $textualbody['creator']['name'],
    ];
    $config = $this->configFactory->get('recogito_integration.settings');
    $vocabulary = $config->get('recogito_integration.vocabulary_name');
    if ($textualbody['purpose'] == 'tagging') {
      $terms = $this->entityTypeManager
        ->getStorage('taxonomy_term')
        ->loadByProperties([
          'name' => $textualbody['value'],
          'vid' => $vocabulary,
        ]);
      $term = reset($terms);
      if (!$term) {
        $term = Term::create([
          'name' => $textualbody['value'],
          'vid' => $vocabulary,
        ]);
        $term->save();
      }
      $params['field_annotation_tag_reference'] = $term->id();
    }
    else {
      $params['field_annotation_value'] = $textualbody['value'];
    }
    $node = Node::create($params);
    $node->save();
    return $node->id();
  }

  /**
   * Creates an annotation node based on the annotation data.
   *
   * @param array $annotation
   *   The annotation data.
   *
   * @return \Drupal\node\Entity\Node
   *   The annotation node.
   */
  public function createAnnotationNode(array $annotation) {
    $params = [
      'type' => 'annotation',
      'langcode' => 'en',
      'created' => time(),
      'changed' => time(),
      'uid' => $this->currentUser->id(),
      'moderation_state' => 'published',
      'title' => $annotation['id'],
      'field_annotation_id' => $annotation['id'],
      'field_annotation_type' => $annotation['type'],
      'field_annotation_page' => [],
      'field_annotation_target_element' => $annotation['target_element'],
    ];
    switch ($annotation['type']) {
      case 'Selection':
        $params['field_annotation_image_source'] = $annotation['image_source'];
        $params['field_annotation_image_value'] = $annotation['image_value'];
        break;

      case 'Annotation':
        $params['field_annotation_target_end'] = $annotation['target_end'];
        $params['field_annotation_target_exact'] = $annotation['target_exact'];
        $params['field_annotation_target_start'] = $annotation['target_start'];
        break;
    }
    $node = Node::create($params);
    $node->save();
    $references = [];
    foreach ($annotation['textualbodies'] as $textualbody) {
      $references[] = self::createTextualbodyNode($textualbody, $node->id());
    }
    $node->set('field_annotation_textualbodies', $references);
    $node->save();
    return $node;
  }

  /**
   * Updates an annotation node based on the annotation data.
   *
   * @param array $annotation
   *   The annotation data.
   * @param \Drupal\node\Entity\Node $node
   *   The annotation node.
   */
  public function updateAnnotationNode(array $annotation, Node $node) {
    $node->set('changed', time());
    if ($annotation['type'] === 'Selection') {
      $node->set('field_annotation_image_value', $annotation['image_value']);
    }
    self::deleteTextualbody($node);
    $references = [];
    foreach ($annotation['textualbodies'] as $textualbody) {
      $references[] = self::createTextualbodyNode($textualbody, $node->id());
    }
    $node->set('field_annotation_textualbodies', $references);
    $node->save();
  }

  /**
   * Deletes the textual body nodes associated with an annotation node.
   *
   * @param \Drupal\node\Entity\Node $node
   *   The annotation node.
   */
  public function deleteTextualbody(Node $node) {
    $textualbodies = $node->get('field_annotation_textualbodies')->referencedEntities();
    foreach ($textualbodies as $textualbody) {
      $textualbody->delete();
    }
  }

}
