<?php

namespace Drupal\recogito_integration\Controller;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Routing\RouteMatchInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Component\Utility\Html;
use Drupal\node\Entity\Node;
use Drupal\paragraphs\Entity\Paragraph;
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
   * The current route match.
   *
   * @var \Drupal\Core\Routing\RouteMatchInterface
   */
  protected $routeMatch;

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
   * @param \Drupal\Core\Routing\RouteMatchInterface $route_match
   *   The route match.
   */
  public function __construct(
    AccountProxyInterface $current_user,
    ConfigFactoryInterface $config_factory,
    EntityTypeManagerInterface $entity_type_manager,
    EntityFieldManagerInterface $entity_field_manager,
    RouteMatchInterface $route_match,
  ) {
    $this->currentUser = $current_user;
    $this->configFactory = $config_factory;
    $this->entityTypeManager = $entity_type_manager;
    $this->entityFieldManager = $entity_field_manager;
    $this->routeMatch = $route_match;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new self(
      $container->get('current_user'),
      $container->get('config.factory'),
      $container->get('entity_type.manager'),
      $container->get('entity_field.manager'),
      $container->get('current_route_match')
    );
  }

  public function validateStyle(array $style) {
    $colorRegex = '/^#(?:[0-9a-fA-F]{3}){1,2}$/';
    $lineStyles = ['dotted', 'dashed', 'double', 'solid', 'groove', 'ridge', 'inset', 'outset', 'none'];
    $config = $this->configFactory->get('recogito_integration.settings');
    $style['text_color'] = preg_match($colorRegex, $style['text_color']) ? $style['text_color'] : ($config->get('recogito_integration.text_color') ?? '#000000');
    $style['background_color'] = preg_match($colorRegex, $style['background_color']) ? $style['background_color'] : ($config->get('recogito_integration.background_color') ?? '#000000');
    $style['underline_color'] = preg_match($colorRegex, $style['underline_color']) ? $style['underline_color'] : ($config->get('recogito_integration.underline_color') ?? '#000000');
    $style['underline_style'] = in_array($style['underline_style'], $lineStyles) ? $style['underline_style'] : ($config->get('recogito_integration.underline_style') ?? 'none');
    $style['underline_stroke'] = is_numeric($style['underline_stroke']) ? $style['underline_stroke'] : ($config->get('recogito_integration.underline_stroke') ?? '0');
    $style['background_transparency'] = is_numeric($style['background_transparency']) ? $style['background_transparency'] : ($config->get('recogito_integration.background_transparency') ?? '0');
    return $style;
  }

  /**
   * Constructs the style for an annotation based on its tags.
   *
   * @param string $style_field
   *   The field name for the annotation profile.
   * @param array $tags
   *   The tags associated with the annotation.
   *
   * @return array
   *   The style for the annotation.
   */
  public function constructStyle(string $style_field, array $tags) {
    $config = $this->configFactory->get('recogito_integration.settings');
    $style = [
      'text_color' => $config->get('recogito_integration.text_color') ?? '#000000',
      'background_color' => $config->get('recogito_integration.background_color') ?? '#000000',
      'underline_color' => $config->get('recogito_integration.underline_color') ?? '#000000',
      'underline_style' => $config->get('recogito_integration.underline_style') ?? 'none',
      'underline_stroke' => $config->get('recogito_integration.underline_stroke') ?? '0',
      'background_transparency' => $config->get('recogito_integration.background_transparency') ?? '0',
    ];
    if (!$tags || empty($style_field)) {
      return $style;
    }
    $min = reset($tags);
    foreach ($tags as $tag) {
      $min_style = $min->get($style_field)->getValue();
      $tag_style = $tag->get($style_field)->getValue();
      if (empty($min_style) || isset($tag_style) && !$min_style[0]['styling_choice']) {
        $min = $tag;
      }
      elseif (!empty($tag_style) && $tag_style[0]['styling_choice'] && $tag_style[0]['styling_weight'] < $min_style[0]['styling_weight']) {
        $min = $tag;
      }
    }
    $min_style = $min->get($style_field)->getValue();
    if (!empty($min_style) && $min_style[0]['styling_choice']) {
      $style = [
        'text_color' => $min_style[0]['text_color'],
        'background_color' => $min_style[0]['background_color'],
        'underline_style' => $min_style[0]['underline_style'],
        'underline_stroke' => $min_style[0]['underline_stroke'],
        'underline_color' => $min_style[0]['underline_color'],
        'background_transparency' => $min_style[0]['background_transparency'],
      ];
      $style = self::validateStyle($style);
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
    $nid = $request->headers->get('nodeId');
    if (!$nid || !is_numeric($nid)) {
      return new JsonResponse('Unable to retrieve annotations as no valid ID was passed.', 500);
    }
    $annotations = self::getAnnotationForNode($nid);
    if (!$annotations) {
      return new JsonResponse(json_encode([]), 200);
    }
    $config = $this->configFactory->get('recogito_integration.settings');
    $field_definitions = $this->entityFieldManager->getFieldDefinitions('taxonomy_term', $config->get('recogito_integration.vocabulary_name'));
    $style_field = '';
    foreach ($field_definitions as $field_name => $field_definition) {
      if ($field_definition->getType() === 'annotation_profile') {
        $style_field = $field_name;
        break;
      }
    }
    $annotationData = [];
    foreach ($annotations as $annotation) {
      $textualbodies = [];
      $tags = [];
      $textualbodyParagraphs = $annotation->get('field_annotation_textualbody')->referencedEntities();
      foreach ($textualbodyParagraphs as $textualbody) {
        $textualOwner = $textualbody->get('field_annotation_creator')->entity;
        $bodyContent = [
          'created' => Html::escape($textualbody->get('field_annotation_date_created')->getString()),
          'modified' => Html::escape($textualbody->get('field_annotation_last_modified')->getString()),
          'purpose' => $textualbody->get('field_annotation_purpose')->getString(),
        ];
        if ($textualOwner) {
          $bodyContent['creator'] = [
            'id' => $textualOwner->id(),
            'name' => Html::escape($textualOwner->getDisplayName()),
          ];
        }
        else {
          $bodyContent['creator'] = [
            'id' => NULL,
            'name' => 'Anonymous',
          ];
        }
        if ($bodyContent['purpose'] === 'tagging') {
          $tag = $textualbody->get('field_annotation_tag_reference')->entity;
          if ($tag) {
            $tags[] = $tag;
            $bodyContent['value'] = Html::escape($tag->getName());
          }
        }
        else {
          $bodyContent['value'] = Html::escape($textualbody->get('field_annotation_comment')->getString());
        }
        $textualbodies[] = $bodyContent;
      }
      $style = self::constructStyle($style_field, $tags);
      $data = [
        'id' => $annotation->get('field_annotation_id')->getString(),
        'textualbodies' => $textualbodies,
        'target_element' => $annotation->get('field_annotation_target_field')->getString(),
        'type' => $annotation->get('field_annotation_type')->getString(),
      ];
      switch ($data['type']) {
        case 'Image':
          $data['image_source'] = $annotation->get('field_image_annotation_source')->getString();
          $data['image_value'] = $annotation->get('field_image_annotation_position')->getString();
          break;

        case 'Text':
          $data['target_end'] = $annotation->get('field_text_annotation_end')->getString();
          $data['target_exact'] = $annotation->get('field_text_annotation_exact')->getString();
          $data['target_start'] = $annotation->get('field_text_annotation_start')->getString();
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
    $nid = $body['nodeId'];
    if (!$nid || !is_numeric($nid)) {
      return new JsonResponse('Unable to create annotation due to no valid node ID being passed.', 500);
    }
    self::createAnnotationNode($body, $nid);
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
    $editable = $user->hasPermission('recogito edit annotations') || ($user->hasPermission('recogito edit own annotations') && $node->getOwnerId() === $user->id());
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
    $deletable = $user->hasPermission('recogito delete annotations') || ($user->hasPermission('recogito delete own annotations') && $node->getOwnerId() === $user->id());
    if (!$deletable) {
      return new JsonResponse('Insufficient permissions - User cannot delete this annotation.', 403);
    }
    self::deleteTextualbody($node);
    $node->delete();
    return new JsonResponse('Successfully deleted annotation!', 200);
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
   * Get all annotations for the node.
   *
   * @param int $nid
   *   The ID of the node the annotations are for.
   *
   * @return \Drupal\node\Entity\Node
   *   The annotation node.
   */
  public function getAnnotationForNode(int $nid) {
    $annotations = $this->entityTypeManager
      ->getStorage('node')
      ->loadByProperties([
        'type' => 'annotation',
        'field_annotation_node_reference' => $nid,
        'status' => 1,
      ]);
    return $annotations;
  }

  /**
   * Creates a textual body node for an annotation.
   *
   * @param array $textualbody
   *   The textual body data.
   *
   * @return array
   *   The paragraph reference set of the textual body node.
   */
  public function createTextualbody(array $textualbody) {
    if (!$textualbody['modified']) {
      $textualbody['modified'] = $textualbody['created'];
    }
    $params = [
      'type' => 'annotation_textualbody',
      'langcode' => 'en',
      'created' => time(),
      'field_annotation_purpose' => $textualbody['purpose'],
      'field_annotation_date_created' => $textualbody['created'],
      'field_annotation_last_modified' => $textualbody['modified'],
    ];
    if ($textualbody['creator']['id']) {
      $params['field_annotation_creator'] = $textualbody['creator']['id'];
    }
    $config = $this->configFactory->get('recogito_integration.settings');
    $vocabulary = $config->get('recogito_integration.vocabulary_name');
    $tag_creation = $config->get('recogito_integration.create_nonexistent_tag');
    $textual_value = urldecode($textualbody['value']);
    if ($textualbody['purpose'] == 'tagging') {
      $terms = $this->entityTypeManager
        ->getStorage('taxonomy_term')
        ->loadByProperties([
          'name' => $textual_value,
          'vid' => $vocabulary,
        ]);
      $term = reset($terms);
      if (!$term && $tag_creation) {
        $term = Term::create([
          'name' => $textual_value,
          'vid' => $vocabulary,
        ]);
        $term->save();
      }
      elseif (!$term && !$tag_creation) {
        return NULL;
      }
      if ($term) {
        $params['field_annotation_tag_reference'] = $term->id();
      }
    }
    else {
      $params['field_annotation_comment'] = $textual_value;
    }
    $paragraph = Paragraph::create($params);
    $paragraph->save();
    return [
      'target_id' => $paragraph->id(),
      'target_revision_id' => $paragraph->getRevisionId(),
    ];
  }

  /**
   * Creates an annotation node based on the annotation data.
   *
   * @param array $annotation
   *   The annotation data.
   * @param int $nid
   *   The ID of the node to which the annotation belongs.
   *
   * @return \Drupal\node\Entity\Node
   *   The annotation node.
   */
  public function createAnnotationNode(array $annotation, int $nid) {
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
      'field_annotation_target_field' => urldecode($annotation['target_element']),
      'field_annotation_node_reference' => $nid,
    ];
    switch ($annotation['type']) {
      case 'Image':
        $params['field_image_annotation_source'] = $annotation['image_source'];
        $params['field_image_annotation_position'] = $annotation['image_value'];
        break;

      case 'Text':
        $params['field_text_annotation_end'] = $annotation['target_end'];
        $params['field_text_annotation_exact'] = $annotation['target_exact'];
        $params['field_text_annotation_start'] = $annotation['target_start'];
        break;
    }
    $node = Node::create($params);
    $node->save();
    $references = [];
    foreach ($annotation['textualbodies'] as $textualbody) {
      $body = self::createTextualbody($textualbody);
      if ($body) {
        $references[] = $body;
      }
    }
    $node->set('field_annotation_textualbody', $references);
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
    if ($annotation['type'] === 'Image') {
      $node->set('field_image_annotation_position', $annotation['image_value']);
    }
    $existingTextualbodies = $node->get('field_annotation_textualbody')->referencedEntities();
    $existingCount = count($existingTextualbodies);
    $count = 0;
    $references = [];
    foreach ($annotation['textualbodies'] as $textualbody) {
      $body = NULL;
      if ($count >= $existingCount) {
        $body = self::createTextualbody($textualbody);
      }
      else {
        $body = self::updateTextualbody($textualbody, $existingTextualbodies[$count]);
      }
      if ($body) {
        $references[] = $body;
      }
      else {
        continue;
      }
      $count++;
    }
    if ($count < $existingCount) {
      for ($i = $count; $i < $existingCount; $i++) {
        $existingTextualbodies[$i]->delete();
      }
    }
    $node->set('field_annotation_textualbody', $references);
    $node->save();
  }

  /**
   * Updates a textual body paragraph based on the textual body data.
   *
   * @param array $textualbody
   *   The textual body data.
   * @param \Drupal\paragraphs\Entity\Paragraph $paragraph
   *   The textual body paragraph.
   *
   * @return array
   *   The paragraph reference set of the textual body paragraph.
   */
  public function updateTextualbody(array $textualbody, Paragraph $paragraph) {
    $paragraph->set('created', time());
    $paragraph->set('field_annotation_purpose', $textualbody['purpose']);
    $paragraph->set('field_annotation_date_created', $textualbody['created']);
    if (!$textualbody['modified']) {
      $textualbody['modified'] = $textualbody['created'];
    }
    $paragraph->set('field_annotation_last_modified', $textualbody['modified']);
    $paragraph->set('field_annotation_creator', $textualbody['creator']['id']);
    $paragraph->set('field_annotation_comment', NULL);
    $paragraph->set('field_annotation_tag_reference', NULL);
    $config = $this->configFactory->get('recogito_integration.settings');
    $vocabulary = $config->get('recogito_integration.vocabulary_name');
    $tag_creation = $config->get('recogito_integration.create_nonexistent_tag');
    $textual_value = urldecode($textualbody['value']);
    if ($textualbody['purpose'] == 'tagging') {
      $terms = $this->entityTypeManager
        ->getStorage('taxonomy_term')
        ->loadByProperties([
          'name' => $textual_value,
          'vid' => $vocabulary,
        ]);
      $term = reset($terms);
      if (!$term && $tag_creation) {
        $term = Term::create([
          'name' => $textual_value,
          'vid' => $vocabulary,
        ]);
        $term->save();
      }
      elseif (!$term && !$tag_creation) {
        return NULL;
      }
      if ($term) {
        $paragraph->set('field_annotation_tag_reference', $term->id());
      }
    }
    else {
      $paragraph->set('field_annotation_comment', $textual_value);
    }
    $paragraph->save();
    return [
      'target_id' => $paragraph->id(),
      'target_revision_id' => $paragraph->getRevisionId(),
    ];
  }

  /**
   * Deletes the textual body nodes associated with an annotation node.
   *
   * @param \Drupal\node\Entity\Node $node
   *   The annotation node.
   */
  public function deleteTextualbody(Node $node) {
    $textualbodies = $node->get('field_annotation_textualbody')->referencedEntities();
    foreach ($textualbodies as $textualbody) {
      $textualbody->delete();
    }
  }

}
