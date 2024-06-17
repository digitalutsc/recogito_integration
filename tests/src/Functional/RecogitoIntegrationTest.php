<?php

namespace Drupal\Tests\RecogitoIntegration\Functional;

use Drupal\Tests\BrowserTestBase;

/**
 * Tests for the Recogito Integration module.
 */
class RecogitoIntegrationTest extends BrowserTestBase {
  /**
   * {@inheritdoc}
   */
  protected static $modules = ['recogito_integration'];
  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';
  /**
   * The user to use during testing.
   *
   * @var \Drupal\user\UserInterface
   */
  private $user;

  /**
   * Perform initial setup tasks that run before every test method.
   */
  public function setUp(): void {
    parent::setUp();
    $this->user = $this->drupalCreateUser([
      'administer site configuration',
      'access content',
      'recogito view annotations',
      'recogito create annotations',
      'recogito edit annotations',
      'recogito edit own annotations',
      'recogito delete annotations',
      'recogito delete own annotations',
    ]);
  }

}
