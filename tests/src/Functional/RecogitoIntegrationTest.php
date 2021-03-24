<?php

namespace Drupal\Tests\RecogitoIntegration\Functional;

use Drupal\Tests\BrowserTestBase;
use Drupal\recogito_integration\Controller\AnnotationStorage;
use Drupal\node\Entity\Node;

/**
 * Tests for the Recogito Integration module.
 */
class RecogitoIntegrationTests extends BrowserTestBase {
  protected static $modules = array('recogito_integration');
  protected $defaultTheme = 'stark';
  private $user;

  /**
   * Perform initial setup tasks that run before every test method.
   */
  public function setUp() {
    parent::setUp();
    $this->user = $this->drupalCreateUser(array(
      'administer site configuration',
      'access content',
      'recogito view annotations',
      'recogito create annotations',
      'recogito edit annotations',
      'recogito edit own annotations',
      'recogito delete annotations',
      'recogito delete own annotations',
    ));
  }

  /**
  * Tests creation of an annotation
  */
 public function testAnnotationCreation() {
   echo $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
   echo strpos(file_get_contents('http://' . $_SERVER["HTTP_HOST"] . $_SERVER['REQUEST_URI']), "Log in");
   // Login.
   
   $this->drupalLogin($this->user);

   // Generator test:
   $client = \Drupal::httpClient();
   $base_url = "http://" . $_SERVER["HTTP_HOST"];
   $request = $client->post("http://" . $_SERVER['HTTP_HOST'] . '/recogito_create_annotation', [
     'headers' => [
       'pageurl' => '/',
       'annotationobj' => json_encode(
           array(
             'textualbodies' => array(
               0 => array(
                 "created" => "2021-03-22T15:39:33.247Z",
                 "creator_id" => $base_url . "/user/" . \Drupal::currentUser()->id(),
                 "creator_name" => \Drupal::currentUser()->getDisplayName(),
                 "modified" => "2021-03-22T15:39:34.141Z",
                 "purpose" => "commenting",
                 "value" => "test1",
               ),
               1 => array(
                 "created" => "2021-03-22T15:39:33.247Z",
                 "creator_id" => $base_url . "/user/" . \Drupal::currentUser()->id(),
                 "creator_name" => \Drupal::currentUser()->getDisplayName(),
                 "modified" => "2021-03-22T15:39:34.141Z",
                 "purpose" => "tagging",
                 "value" => "test2",
               ),
             ),
             'id' => "#70020740-4a28-46cd-a8f2-6456aadd4053",
             "target_exact" => "test",
             "target_start" => "0",
             "target_end" => "1",
             "title" => "#70020740-4a28-46cd-a8f2-6456aadd4053",
           )
         )
     ],
   ]);
   $response = json_decode($request->getBody());

   $query = \Drupal::entityQuery('node');
   $query->condition('status', 1);
   $query->condition('type', "annotation");
   $result = $query->execute();

   $this.assertTrue($response == "Successful annotation creation","Bad response: " . $response);
 }
}
