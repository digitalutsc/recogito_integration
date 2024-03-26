<?php

namespace Drupal\recogito_integration\Plugin\Field\FieldFormatter;

use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Field\FormatterBase;

/**
 * Plugin implementation of the 'annotation_profile_formatter' formatter.
 *
 * @FieldFormatter(
 *   id = "annotation_profile_formatter",
 *   label = @Translation("Annotation Profile Formatter"),
 *   field_types = {
 *     "annotation_profile"
 *   }
 * )
 */
class AnnotationProfileFormatter extends FormatterBase {

  /**
   * {@inheritdoc}
   */
  public function viewElements(FieldItemListInterface $items, $langcode) {
    $elements = [];
    foreach ($items as $delta => $item) {
      if ($item->styling_choice == 1) {
        $elements[$delta] = [
          'styling_weight' => [
            '#markup' => '<strong>Styling Weight:</strong><br>' . $item->styling_weight,
          ],
          'background_color' => [
            '#type' => 'inline_template',
            '#template' => '<div><strong>Background Color:</strong><br><div style="background-color: {{ color }}; width: 50px; height: 50px; border: 1px solid black;"></div></div>',
            '#context' => ['color' => $item->background_color],
          ],
          'background_transparency' => [
            '#markup' => '<strong>Background Transparency:</strong><br>' . $item->background_transparency,
          ],
          'text_color' => [
            '#type' => 'inline_template',
            '#template' => '<div><strong>Text Color:</strong><br><div style="background-color: {{ color }}; width: 50px; height: 50px; border: 1px solid black;"></div></div>',
            '#context' => ['color' => $item->text_color],
          ],
          'underline_stroke' => [
            '#markup' => '<strong>Underline Stroke:</strong><br>' . $item->underline_stroke,
          ],
          'underline_color' => [
            '#type' => 'inline_template',
            '#template' => '<div><strong>Underline Color:</strong><br><div style="background-color: {{ color }}; width: 50px; height: 50px; border: 1px solid black;"></div></div>',
            '#context' => ['color' => $item->underline_color],
          ],
          'underline_style' => [
            '#markup' => '<strong>Underline Style:</strong><br>' . $item->underline_style,
          ],
        ];
      }
    }
    return $elements;
  }

}
