<?php

namespace Drupal\recogito_integration\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\node\NodeInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\Core\Access\AccessResult;

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
   * Constructs a new RecogitoIntegrationController object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager service.
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The configuration factory service.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager, ConfigFactoryInterface $config_factory) {
    $this->entityTypeManager = $entity_type_manager;
    $this->configFactory = $config_factory;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('config.factory')
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
    $build['#title'] = $node->getTitle() . ' - Annotation Mode';
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
    return AccessResult::allowedIf($access)->addCacheableDependency($config);
  }

}
