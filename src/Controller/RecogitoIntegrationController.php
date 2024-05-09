<?php

namespace Drupal\recogito_integration\Controller;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\node\NodeInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Controller for Recogito Integration's annotate page for nodes.
 */
class RecogitoIntegrationController extends ControllerBase {
  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;
  /**
   * The config factory.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected $configFactory;

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * Constructs a new RecogitoIntegrationController object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager service.
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The configuration factory service.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    ConfigFactoryInterface $config_factory,
    AccountProxyInterface $current_user,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->configFactory = $config_factory;
    $this->currentUser = $current_user;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new self(
      $container->get('entity_type.manager'),
      $container->get('config.factory'),
      $container->get('current_user')
    );
  }

  /**
   * Display the annotations page.
   *
   * @param \Drupal\node\NodeInterface $node
   *   The node entity.
   *
   * @return array
   *   A render array representing the annotations page content.
   */
  public function annotationsPage(NodeInterface $node) {
    $build = $this->entityTypeManager->getViewBuilder('node')->view($node, 'full');
    $build['#title'] = $node->getTitle();
    $build['#cache']['max-age'] = 0;
    return $build;
  }

  /**
   * Check access for the annotations page.
   *
   * @param \Drupal\Core\Session\AccountInterface $account
   *   The current user.
   * @param \Drupal\node\NodeInterface $node
   *   The node entity.
   *
   * @return \Drupal\Core\Access\AccessResult
   *   The access result.
   */
  public function access(AccountInterface $account, NodeInterface $node) {
    $config = $this->configFactory->get('recogito_integration.settings');
    $annotatables = $config->get('recogito_integration.annotatables') ?? [];
    if (!isset($annotatables[$node->getType()])) {
      return AccessResult::allowedIf(FALSE)->addCacheableDependency($config);
    }
    $access = $annotatables[$node->getType()]['enabled'] ?? FALSE;
    $access = $access && $this->currentUser->hasPermission('recogito create annotations') && $this->currentUser->isAuthenticated();
    return AccessResult::allowedIf($access)->addCacheableDependency($config);
  }

}
