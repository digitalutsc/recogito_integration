<?php

namespace Drupal\recogito_integration\Plugin\Field\FieldWidget;

use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Field\WidgetBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Plugin implementation of the 'annotation_profile_widget' widget.
 *
 * @FieldWidget(
 *   id = "annotation_profile_widget",
 *   label = @Translation("Annotation Profile Widget"),
 *   field_types = {
 *     "annotation_profile"
 *   }
 * )
 */
class AnnotationProfileWidget extends WidgetBase {

  /**
   * {@inheritdoc}
   */
  public function formElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state) {
    $field_name = $items->getName();
    $element['styling_choice'] = [
      '#type' => 'select',
      '#title' => $this->t('Styling Choice'),
      '#options' => [
        0 => $this->t('No Style'),
        1 => $this->t('Custom Style'),
      ],
      '#default_value' => $items[$delta]->styling_choice ?? 0,
      '#description' => $this->t('Choose the styling option.'),
    ];

    $element['styling_weight'] = [
      '#type' => 'number',
      '#title' => $this->t('Styling Weight'),
      '#default_value' => $items[$delta]->styling_weight ?? 0,
      '#description' => $this->t('Lower the weight the higher priority it is going to be used over other tags!'),
      '#states' => [
        'visible' => [
          ':input[name="' . $field_name . '[' . $delta . '][styling_choice]"]' => ['!value' => '0'],
        ],
      ],
    ];

    $element['custom_style'] = [
      '#type' => 'fieldset',
      '#title' => $this->t('Custom Style'),
      '#states' => [
        'visible' => [
          ':input[name="' . $field_name . '[' . $delta . '][styling_choice]"]' => ['!value' => '0'],
        ],
      ],
    ];

    $element['custom_style']['background_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Background Color'),
      '#default_value' => $items[$delta]->background_color ?? '#ffffff',
      '#description' => $this->t('Choose a background color.'),
    ];

    $element['custom_style']['background_transparency'] = [
      '#type' => 'number',
      '#title' => $this->t('Background Transparency'),
      '#default_value' => $items[$delta]->background_transparency ?? 0,
      '#min' => 0,
      '#max' => 1,
      '#step' => 0.01,
      '#description' => $this->t('Set the background transparency between 0 and 1.'),
    ];

    $element['custom_style']['text_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Text Color'),
      '#default_value' => $items[$delta]->text_color ?? '#ffffff',
      '#description' => $this->t('Choose a text color.'),
    ];

    $element['custom_style']['underline_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Underline Color'),
      '#default_value' => $items[$delta]->underline_color ?? '#ffffff',
      '#description' => $this->t('Choose an underline color.'),
    ];

    $element['custom_style']['underline_stroke'] = [
      '#type' => 'number',
      '#title' => $this->t('Underline Stroke'),
      '#default_value' => $items[$delta]->underline_stroke ?? 0,
      '#description' => $this->t('Enter the underline stroke (px).'),
    ];

    $element['custom_style']['underline_style'] = [
      '#type' => 'select',
      '#title' => $this->t('Underline Style'),
      '#options' => [
        'dotted' => $this->t('Dotted'),
        'dashed' => $this->t('Dashed'),
        'double' => $this->t('Double'),
        'solid' => $this->t('Solid'),
        'groove' => $this->t('Groove'),
        'ridge' => $this->t('Ridge'),
        'inset' => $this->t('Inset'),
        'outset' => $this->t('Outset'),
        'none' => $this->t('None'),
      ],
      '#default_value' => $items[$delta]->underline_style ?? 'none',
      '#description' => $this->t('Select the underline style.'),
    ];
    return $element;
  }

  /**
   * {@inheritdoc}
   */
  public function massageFormValues(array $values, array $form, FormStateInterface $form_state) {
    foreach ($values as $delta => $value) {
      $values[$delta]['background_color'] = $value['custom_style']['background_color'];
      $values[$delta]['background_transparency'] = $value['custom_style']['background_transparency'];
      $values[$delta]['text_color'] = $value['custom_style']['text_color'];
      $values[$delta]['underline_color'] = $value['custom_style']['underline_color'];
      $values[$delta]['underline_stroke'] = $value['custom_style']['underline_stroke'];
      $values[$delta]['underline_style'] = $value['custom_style']['underline_style'];
    }
    return $values;
  }

}
