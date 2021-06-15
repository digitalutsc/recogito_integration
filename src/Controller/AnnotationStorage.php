<?php

namespace Drupal\recogito_integration\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\node\Entity\Node;
use Drupal\taxonomy\Entity\Term;
use Symfony\Component\HttpFoundation\JsonResponse;
use Masterminds\HTML5\Exception;
use GuzzleHttp\Exception\RequestException;

/**
 * Controller for Recogito JS operations on annotations and related content.
 */
class AnnotationStorage extends ControllerBase {

  /**
  * Creates an annotation from data provided by the HTTP request.
  * @return JsonResponse Annotation status after running function
  */
  public function createAnnotation(){
    #Check permissions
    if (!\Drupal::currentUser()->hasPermission('recogito create annotations')) {
      return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot create annotations"));
    }
    $page_url = \Drupal::request()->server->get('HTTP_PAGEURL');
    $annotation = json_decode(\Drupal::request()->server->get('HTTP_ANNOTATIONOBJ'));
    #Create annotation
    self::createNewAnnotationNode($annotation);
    $annotation_node = self::queryAnnotationNode($annotation->id);
    $annotation_collection_node = self::queryAnnotationCollectionNode($page_url);
    #If annotation collection for this page doesn't exist, then create one
    if (!isset($annotation_collection_node)) {
      self::createNewAnnotationCollectionNode($page_url);
      $annotation_collection_node = self::queryAnnotationCollectionNode($page_url);
    }
    #Add annotation reference to the annotation collection
    self::AnnotationCollectionAddAnnotation($annotation_collection_node, $annotation_node);
    return JsonResponse::fromJsonString(json_encode("Successful annotation creation"));
  }

  /**
  * Get an array of all annotation objects stored at the page provided by the HTTP request.
  * @return JsonResponse Annotation status after running function, or list of annotation objects if successful.
  */
  public function readAnnotations() {
    #Check permissions
    if (!\Drupal::currentUser()->hasPermission('recogito view annotations')) {
      return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot view annotations"));
    }
    $page_url = \Drupal::request()->server->get('HTTP_PAGEURL');
    $annotation_collection_node = self::queryAnnotationCollectionNode($page_url);
    if (!isset($annotation_collection_node)) {
      return new JsonResponse();
    }
    #Get array of all references to annotations on this page
    $annotation_references = $annotation_collection_node->get('field_annotation_reference');
    #Create object to store & return all annotations on page
    $annotation_array = array();
    foreach($annotation_references->referencedEntities() as $annotation_node) {
      $textualbodies = array();
      foreach($annotation_node->get('field_annotation_textualbodies')->referencedEntities() as $textualbody) {
        $textualbodies[] = array(
          'created' => $textualbody->get('field_annotation_created')->getValue(),
          'creator_id' => $textualbody->get('field_annotation_creator_id')->getValue(),
          'creator_name' => $textualbody->get('field_annotation_creator_name')->getValue(),
          'modified' => $textualbody->get('field_annotation_modified')->getValue(),
          'purpose' => $textualbody->get('field_annotation_purpose')->getValue(),
          'value' => $textualbody->get('field_annotation_value')->getValue(),
        );
      }
      $annotation_object = array(
        'id' => $annotation_node->get('field_annotation_id')->getValue(),
        'target_end' => $annotation_node->get('field_annotation_target_end')->getValue(),
        'target_exact' => $annotation_node->get('field_annotation_target_exact')->getValue(),
        'target_start' => $annotation_node->get('field_annotation_target_start')->getValue(),
        'textualbodies' => $textualbodies
      );
      if ($annotation_node->get('field_annotation_type')->getValue()[0]["value"] == "Selection") {
        $annotation_object['image_source'] = $annotation_node->get('field_annotation_image_source')->getValue();
        $annotation_object['image_value'] = $annotation_node->get('field_annotation_image_value')->getValue();
      } else {
        $annotation_object['target_end'] =  $annotation_node->get('field_annotation_target_end')->getValue();
        $annotation_object['target_exact'] = $annotation_node->get('field_annotation_target_exact')->getValue();
        $annotation_object['target_start'] = $annotation_node->get('field_annotation_target_start')->getValue();
      }
      $annotation_object['type'] = $annotation_node->get('field_annotation_type')->getValue();
      $annotation_array[] = $annotation_object;
    }
    return JsonResponse::fromJsonString(json_encode($annotation_array));
  }

  /**
  * Given an annotation object, update a stored object with matching ids
  * @return JsonResponse Annotation status after running function
  */
  public function updateAnnotation() {
    $annotation = json_decode(\Drupal::request()->server->get('HTTP_ANNOTATIONOBJ'));
    $annotation_node = self::queryAnnotationNode($annotation->id);
    if (!isset($annotation_node)) {
      return JsonResponse::fromJsonString(json_encode("Nonexistent annotation ID"));
    }
    #Check permissions
    foreach(Node::load($annotation_node)->get('field_annotation_textualbodies')->referencedEntities() as $oldtextualbody) {
      unset($annotationfound);
      foreach($annotation->textualbodies as $newtextualbody) {
        if ($oldtextualbody->get('field_annotation_created')->getValue()[0]["value"] == $newtextualbody->created) {
          $newtextualbody->edited = true;
          $annotationfound = true;
          if ($oldtextualbody->get('field_annotation_value')->getValue()[0]["value"] != $newtextualbody->value) {
            if ($oldtextualbody->get('field_annotation_creator_name')->getValue()[0]["value"] == \Drupal::currentUser()->getDisplayName()) {
              if (!\Drupal::currentUser()->hasPermission('recogito edit own annotations') && !\Drupal::currentUser()->hasPermission('recogito edit annotations')) {
                return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot edit own annotations"));
              }
            } else if (!\Drupal::currentUser()->hasPermission('recogito edit annotations')) {
              return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot edit annotations"));
            }
          }
        }
      }
      if (!isset($annotationfound)) {
        if ($oldtextualbody->get('field_annotation_creator_name')->getValue()[0]["value"] == \Drupal::currentUser()->getDisplayName()) {
          if (!\Drupal::currentUser()->hasPermission('recogito delete own annotations') && !\Drupal::currentUser()->hasPermission('recogito delete annotations')) {
            return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot delete own annotations"));
          }
        } else if (!\Drupal::currentUser()->hasPermission('recogito delete annotations')) {
          return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot delete annotations"));
        }
      }
    }
    foreach($annotation->textualbodies as $newtextualbody) {
      if (!isset($newtextualbody->edited)) {
        if (!\Drupal::currentUser()->hasPermission('recogito create annotations')) {
          return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot create annotations"));
        }
      }
      unset($newtextualbody->edited);
    }
    #Call the update function
    self::updateAnnotationNode($annotation_node, $annotation);
    self::DeleteUnneededTags();
    return JsonResponse::fromJsonString(json_encode("Successful annotation update"));
  }
  /**
  * Given an annotation object, delete the object with matching ID from Drupal storage..
  * @return JsonResponse Annotation status after running function
  */
  public function deleteAnnotation() {
    // add utf8_decode call for annotation json with diacritics to assist json_decode (was return null)

    $annotation = json_decode(\Drupal::request()->server->get('HTTP_ANNOTATIONOBJ'));
    $annotation_node = self::queryAnnotationNode($annotation->id);
    if (!isset($annotation_node)) {
      return JsonResponse::fromJsonString(json_encode("Nonexistent annotation ID"));
    }
    #Check for permissions
    if (\Drupal::currentUser()->id() == Node::load($annotation_node)->getOwnerId()) {
      if (!\Drupal::currentUser()->hasPermission('recogito delete own annotations') && !\Drupal::currentUser()->hasPermission('recogito delete annotations')) {
        return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot delete own annotations"));
      }
    } else {
      if (!\Drupal::currentUser()->hasPermission('recogito delete annotations')) {
        return JsonResponse::fromJsonString(json_encode("Insufficient permissions - User cannot delete others' annotations"));
      }
    }
    #Delete stored textualbodies before deleting the node
    foreach(Node::load($annotation_node)->get('field_annotation_textualbodies')->referencedEntities() as $textualbody) {
      $textualbody->delete();
    }
    Node::load($annotation_node)->delete();
    self::DeleteUnneededTags();
    return JsonResponse::fromJsonString(json_encode("Successful annotation deletion"));
  }

  /**
  * Creates a TextualBody Node to store data in an annotation.
  * @param object $textualbody An object containing all textualbody data to be entered in the Node.
  * @param int $target Node id referring to the Annotation object that is to refer to the TextualBody
  * @return int|void Return the node id of the new Node if successfully created, otherwise null
  */
  public function createNewTextualBodyNode($textualbody, $target) {
    if (!isset($textualbody->modified)) {
      $textualbody->modified = $textualbody->created;
    }
    $params = [
        'type' => 'annotation_textualbody',
        'langcode' => 'en',
        'created' => time(),
        'changed' => time(),
        'uid' => \Drupal::currentUser()->id(),
        'moderation_state' => 'published',

        # annotation fields
        // Kyle changed for annotation text has length > 255 when store it in this title field
        //'title' => $textualbody->value,
        'title' => (strlen($textualbody->value) > 255) ? substr($textualbody->value, 0, 255) : $textualbody->value,
        'field_annotation_created' => $textualbody->created,
        'field_annotation_creator_id' => $textualbody->creator_id,
        'field_annotation_creator_name' => $textualbody->creator_name,
        'field_annotation_modified' => $textualbody->modified,
        'field_annotation_purpose' => $textualbody->purpose,
        'field_annotation_target' => $target,
        'field_annotation_value' => $textualbody->value

    ];
    $node = Node::create($params);
    $node->save();
    #If TextualBody is a tag, upload the tag as a term to an annotation vocabulary if not already a term
    if ($textualbody->purpose == 'tagging') {
      unset($foundTaxonomyTerm);
      foreach (\Drupal::entityTypeManager()->getStorage('taxonomy_term')->loadTree(\Drupal::config('recogito_integration.settings')->get('recogito_integration.annotation_vocab_name')) as $term) {
        if ($term->name == $textualbody->value) {
          $foundTaxonomyTerm = true;
        }
      }
      if (!isset($foundTaxonomyTerm)) {
        Term::create([
          'name' => $textualbody->value,
          'vid' => \Drupal::config('recogito_integration.settings')->get('recogito_integration.annotation_vocab_name'),
        ])->save();
      }
    }

    return $node->id();
  }

  /**
  * Return the id of a Node matching an id generated by the Recogito JS library.
  * @param int $annotation_id Node id referring to the Annotation object
  * @return int|void Return the node id of the new Node if successfully created, otherwise null
  */
  public function queryAnnotationNode($annotation_id)
  {
      $query = \Drupal::entityQuery('node');
      $query->condition('status', 1);
      $query->condition('type', "annotation");
      $query->condition('field_annotation_id', $annotation_id);
      $result = $query->execute();
      if (isset($result)) {
        return reset($result);
      }

  }

  /**
  * Creates an Annotation node to store data for an annotation.
  * @param object $annotation An object containing all annotation data to be entered in the Node.
  */
  public function createNewAnnotationNode($annotation)
  {

      // create new annotation node
      $params = [
          'type' => 'annotation',
          'langcode' => 'en',
          'created' => time(),
          'changed' => time(),
          'uid' => \Drupal::currentUser()->id(),
          'moderation_state' => 'published',

          // annotation fields
          'title' => $annotation->title,
          'field_annotation_id' => $annotation->id,
          'field_annotation_type' =>$annotation->type,
      ];
      if ($annotation->type == "Selection") {
        $params['field_annotation_image_source'] = $annotation->image_source;
        $params['field_annotation_image_value'] = $annotation->image_value;
      } else {
        $params['field_annotation_target_end'] = $annotation->target_end;
        $params['field_annotation_target_exact'] = $annotation->target_exact;
        $params['field_annotation_target_start'] = $annotation->target_start;
      }

      $node = Node::create($params);
      $node->save();

      $references = [];
      foreach($annotation->textualbodies as $textualbody) {
        $references[] = self::CreateNewTextualBodyNode($textualbody, $node->id());
      }
      $node->set('field_annotation_textualbodies', $references);
      $node->save();
  }

  /**
  * Given an annotation object and Node, update the Node with data from the object.
  * @param int $nid Node id referring to the Annotation object
  * @param object $annotation The object containing all annotatino data.
  */
  public function updateAnnotationNode($nid, $annotation)
  {
      // update existing Annotation node
      $annotationNode = Node::load($nid);
      if (isset($annotationNode)) {
          $annotationNode->set('changed', time());

          $annotationNode->set('title', $annotation->title);

          $annotationNode->set('field_annotation_id', $annotation->id);

          $annotationNode->set('field_annotation_type', $annotation->type);

          if ($annotation->type == "Selection") {
            $annotationNode->set('field_annotation_image_source',$annotation->image_source);
            $annotationNode->set('field_annotation_image_value',$annotation->image_value);
          } else {
            $annotationNode->set('field_annotation_target_end',$annotation->target_end);
            $annotationNode->set('field_annotation_target_exact',$annotation->target_exact);
            $annotationNode->set('field_annotation_target_start',$annotation->target_start);
          }

          foreach($annotationNode->get('field_annotation_textualbodies')->referencedEntities() as $textualbody) {
            $textualbody->delete();
          }
          #Recreate all TextualBodies
          $references = [];
          foreach($annotation->textualbodies as $textualbody) {
            $references[] = self::createNewTextualBodyNode($textualbody, $annotationNode->id());
          }
          $annotationNode->set('field_annotation_textualbodies', $references);

          $annotationNode->save();
      }
  }

  /**
  * Given a page url, return the Annotation Collection node referring to that url if it exists.
  * @param string $page_url The url to the page to query.
  * @return int|void The Node id of the annotation collection node if it exists, otherwise null
  */
  public function queryAnnotationCollectionNode($page_url)
  {
      $query = \Drupal::entityQuery('node')
      ->condition('status', 1)
      ->condition('type', "annotation_collection")
      ->condition('field_annotation_collection_url', $page_url);
      $result = $query->execute();
      if (count($result) > 0) {
        return Node::load(reset($result));
      }

  }

  /**
  * Create a new annotation collection node given a page url.
  * @param string $page_url The page url to generate a Node with.
  */
  public function createNewAnnotationCollectionNode($page_url)
  {
      // create new annotation collection node
      $params = [
          // The node entity bundle.
          'type' => 'annotation_collection',
          'langcode' => 'en',
          'created' => time(),
          'changed' => time(),
          // The user ID.
          'uid' => \Drupal::currentUser()->id(),
          'moderation_state' => 'published',

          // annotation collection fields
          'title' => 'Annotation Collection: ' . $page_url,

          'field_annotation_reference' => array(),
          'field_annotation_collection_url' => $page_url,
      ];
      $node = Node::create($params);
      $node->save();
  }

  /**
  * Adds an annotation to be referred to by an Annotation Collection Node.
  * @param Node $annotationCollectionNode The Annotation Collection Node to add to.
  * @param int $annotation_id The id of the Annotation Node to add to the Annotation Collection Node.
  */
  public function AnnotationCollectionAddAnnotation($annotationCollectionNode, $annotation_id)
  {
      // update existing Annotation node
      if (isset($annotationCollectionNode)) {
          $annotationCollectionNode->set('changed', time());

          $annotationCollectionNode->field_annotation_reference[] = $annotation_id;


          $annotationCollectionNode->save();

          $annotation_node = Node::load($annotation_id);
          if (isset($annotation_node)) {
            $annotation_node->set('changed', time());

            $annotation_node->field_annotation_page[] = $annotationCollectionNode->id();


            $annotation_node->save();
          }
      }
  }

  /**
  * Delete any tags that don't appear in the given vocabulary.
  */
  public function DeleteUnneededTags() {
    $tids = \Drupal::entityQuery('taxonomy_term')
      -> condition('vid', \Drupal::config('recogito_integration.settings')->get('recogito_integration.annotation_vocab_name'))
      -> execute();
    foreach($tids as $tid) {
      $term = Term::load($tid);
      $tags = \Drupal::entityQuery('node')
      ->condition('status', 1)
      ->condition('type', "annotation_textualbody")
      ->condition('field_annotation_purpose', 'tagging')
      ->condition('field_annotation_value', ((isset($term)) ? $term->get('name')->value: ''))
      ->execute();
      if (count($tags) == 0) {
        $term->delete();
      }
    }
  }
}
