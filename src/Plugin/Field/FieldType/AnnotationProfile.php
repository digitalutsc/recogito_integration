<?php

namespace Drupal\recogito_integration\Plugin\Field\FieldType;

use Drupal\Core\Field\FieldItemBase;
use Drupal\Core\Field\FieldStorageDefinitionInterface;
use Drupal\Core\TypedData\DataDefinition;

/**
 * Plugin implementation for annotation profile field type.
 *
 * @FieldType(
 *   id = "annotation_profile",
 *   label = @Translation("Annotation Profile Color Field"),
 *   description = @Translation("Stores color profiles for annotations."),
 *   default_widget = "annotation_profile_widget",
 *   default_formatter = "annotation_profile_formatter"
 * )
 */
class AnnotationProfile extends FieldItemBase {

  /**
   * {@inheritdoc}
   */
  public static function propertyDefinitions(FieldStorageDefinitionInterface $field_definition) {
    $properties = [];

    $properties['styling_choice'] = DataDefinition::create('integer')
      ->setLabel(t('Styling Choice'));

    $properties['styling_weight'] = DataDefinition::create('integer')
      ->setLabel(t('Styling Weight'));

    $properties['background_color'] = DataDefinition::create('string')
      ->setLabel(t('Background Color'));

    $properties['background_transparency'] = DataDefinition::create('float')
      ->setLabel(t('Background Transparency'));

    $properties['text_color'] = DataDefinition::create('string')
      ->setLabel(t('Text Color'));

    $properties['underline_color'] = DataDefinition::create('string')
      ->setLabel(t('Underline Color'));

    $properties['underline_stroke'] = DataDefinition::create('integer')
      ->setLabel(t('Underline Stroke (px)'));

    $properties['underline_style'] = DataDefinition::create('string')
      ->setLabel(t('Underline Style'));

    return $properties;
  }

  /**
   * {@inheritdoc}
   */
  public static function mainPropertyName() {
    return 'background_color';
  }

  /**
   * {@inheritdoc}
   */
  public function isEmpty() {
    $text_color = $this->get('text_color')->getValue();
    $background_color = $this->get('background_color')->getValue();
    return $text_color === NULL || $text_color === 'none' || $background_color === NULL || $background_color === 'none';
  }

  /**
   * {@inheritdoc}
   */
  public static function schema(FieldStorageDefinitionInterface $field_definition) {
    $columns = [];

    $columns['styling_choice'] = [
      'not null' => FALSE,
      'type' => 'int',
      'size' => 'tiny',
      'default' => 0,
      'description' => 'The styling choice.',
    ];

    $columns['styling_weight'] = [
      'not null' => FALSE,
      'type' => 'int',
      'size' => 'tiny',
      'default' => 0,
      'description' => 'The weight of the styling.',
    ];

    $columns['background_color'] = [
      'not null' => FALSE,
      'type' => 'varchar',
      'length' => 7,
      'default' => 'none',
      'description' => 'The background color of the annotation.',
    ];

    $columns['background_transparency'] = [
      'not null' => FALSE,
      'type' => 'float',
      'default' => -1,
      'description' => 'The transparency of the background color.',
    ];

    $columns['text_color'] = [
      'not null' => FALSE,
      'type' => 'varchar',
      'length' => 7,
      'default' => 'none',
      'description' => 'The text color of the annotation.',
    ];

    $columns['underline_color'] = [
      'not null' => FALSE,
      'type' => 'varchar',
      'length' => 7,
      'default' => 'none',
      'description' => 'The underline color of the annotation.',
    ];

    $columns['underline_stroke'] = [
      'not null' => FALSE,
      'type' => 'int',
      'size' => 'tiny',
      'default' => -1,
      'description' => 'The stroke size (px) of the underline.',
    ];

    $columns['underline_style'] = [
      'not null' => FALSE,
      'type' => 'varchar',
      'length' => 32,
      'default' => 'none',
      'description' => 'The style of the underline.',
    ];

    return [
      'columns' => $columns,
      'indexes' => [],
    ];
  }

}
