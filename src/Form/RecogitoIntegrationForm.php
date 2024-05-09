<?php

namespace Drupal\recogito_integration\Form;

use Drupal\Core\Cache\CacheTagsInvalidatorInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\field\Entity\FieldConfig;
use Drupal\taxonomy\Entity\Vocabulary;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Form for Recogito Integration's config.
 */
class RecogitoIntegrationForm extends ConfigFormBase {

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
   * The cache tags invalidator.
   *
   * @var \Drupal\Core\Cache\CacheTagsInvalidatorInterface
   */
  protected $cacheTagsInvalidator;

  /**
   * Constructs a new RecogitoIntegrationForm.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Entity\EntityFieldManagerInterface $entity_field_manager
   *   The entity field manager.
   * @param \Drupal\Core\Cache\CacheTagsInvalidatorInterface $cache_tags_invalidator
   *   The cache tags invalidator.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    EntityFieldManagerInterface $entity_field_manager,
    CacheTagsInvalidatorInterface $cache_tags_invalidator,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->entityFieldManager = $entity_field_manager;
    $this->cacheTagsInvalidator = $cache_tags_invalidator;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new self(
      $container->get('entity_type.manager'),
      $container->get('entity_field.manager'),
      $container->get('cache_tags.invalidator')
    );
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'recogito_integration_form';
  }

  /**
   * Provide a selection form based on checked content type.
   *
   * Callback occurs when a content type is checked.
   *
   * @param array $form
   *   An associative array containing the structure of the form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The current state of the form.
   *
   * @return array
   *   The field form element that will be inserted into the container.
   */
  public function contentTypesCallback(array &$form, FormStateInterface $form_state) {
    $trigger_element = $form_state->getTriggeringElement();
    $ct = $trigger_element['#ajax']['content_type'];
    return $form['annotatables'][$ct . '_container'];
  }

  /**
   * Provide a form based on selected vocabulary.
   *
   * Callback occurs when a vocabulary is selected.
   *
   * @param array $form
   *   An associative array containing the structure of the form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The current state of the form.
   *
   * @return array
   *   The field form element that will be inserted into the container.
   */
  public function vocabularyCallback(array &$form, FormStateInterface $form_state) {
    return $form['tag_set']['term_settings_container'];
  }

  /**
   * Load fields for a given content type.
   *
   * @param string $ct
   *   The content type to load fields for.
   *
   * @return array
   *   An associative array of field names and labels.
   */
  public function loadFields(string $ct) {
    $fields = $this->entityFieldManager->getFieldDefinitions('node', $ct);
    $field_options = [];
    foreach ($fields as $field_name) {
      if ($field_name instanceof FieldConfig) {
        $field_options[$field_name->getName()] = $field_name->getLabel();
      }
    }
    return $field_options;
  }

  /**
   * Load tags for a given vocabulary.
   *
   * @param string $vocabulary
   *   The vocabulary to load tags for.
   *
   * @return array
   *   An associative array of tag names and tids.
   */
  public function loadTags(string $vocabulary = '') {
    if ($vocabulary === NULL) {
      return [];
    }
    $tags = $this->entityTypeManager->getStorage('taxonomy_term')->loadTree($vocabulary);
    $tag_options = [];
    foreach ($tags as $tag) {
      $tag_options[$tag->tid] = $tag->name;
    }
    return $tag_options;
  }

  /**
   * Checks if a vocabulary has tags associated in annotations.
   *
   * @var string $vocabulary
   *   The vocabulary to check for existing tags.
   *
   * @return bool
   *   TRUE if the vocabulary has existing tags, FALSE otherwise.
   */
  public function hasTags(string $vocabulary) {
    if (!$vocabulary) {
      return FALSE;
    }
    $textualbodies = $this->entityTypeManager
      ->getStorage('paragraph')
      ->loadByProperties([
        'type' => 'annotation_textualbody',
        'field_annotation_purpose' => 'tagging',
      ]);
    foreach ($textualbodies as $textualbody) {
      $tags = $textualbody->get('field_annotation_tag_reference')->referencedEntities();
      foreach ($tags as $tag) {
        if ($tag->bundle() == $vocabulary) {
          return TRUE;
        }
      }
    }
    return FALSE;
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    $form = parent::buildForm($form, $form_state);
    $config = $this->config('recogito_integration.settings');
    $content_types = $this->entityTypeManager->getStorage('node_type')->loadMultiple();
    $ct_options = [];
    foreach ($content_types as $ct) {
      if ($ct->id() != 'annotation') {
        $ct_options[$ct->id()] = $ct->label();
      }
    }

    $form['annotatables'] = [
      '#type' => 'fieldset',
      '#title' => $this->t('Annotatable Content'),
      '#description' => $this->t('Select the content types and fields that should be annotatable.'),
    ];

    foreach ($ct_options as $ct => $label) {
      $annotatables = $config->get('recogito_integration.annotatables') ?? [];
      $contentSave = $annotatables[$ct] ?? [];
      $form['annotatables'][$ct . '_annotatable'] = [
        '#type' => 'checkbox',
        '#title' => $label,
        '#default_value' => $contentSave['enabled'] ?? 0,
        '#ajax' => [
          'callback' => '::contentTypesCallback',
          'wrapper' => $ct . '_container',
          'content_type' => $ct,
        ],
      ];

      $form['annotatables'][$ct . '_container'] = [
        '#type' => 'container',
        '#attributes' => ['id' => $ct . '_container'],
      ];

      $current_value = $form_state->getValue($ct . '_annotatable');
      $saved_value = $contentSave['enabled'] ?? 0;
      if (($current_value === NULL && $saved_value ?? FALSE) || $current_value) {
        $form['annotatables'][$ct . '_container'][$ct . '_annotatable_fields'] = [
          '#type' => 'select',
          '#title' => $this->t('Select fields to annotate'),
          '#options' => $this->loadFields($ct),
          '#multiple' => TRUE,
          '#size' => 10,
          '#default_value' => $contentSave['fields'] ?? [],
        ];
      }
    }

    $form['annotatables']['custom_annotations'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Enable custom annotation on HTML elements'),
      '#default_value' => $config->get('recogito_integration.custom_annotations') ?? 0,
    ];

    $custom_description = '<strong><u>Note:</u></strong> One element per line. If it\'s class name, 
    use dot("."). If it\'s ID, use "#". 
    <br /><strong>For example:</strong>
    <br />.content
    <br />.body
    <br />#article-1
    <br />#article-2';
    $form['annotatables']['custom_annotations_elements'] = [
      '#type' => 'textarea',
      '#title' => $this->t('List of specific HTML Element(s) to attach the Recogito JS library to:'),
      '#default_value' => $config->get('recogito_integration.custom_annotations_elements') ?? '',
      '#description' => $custom_description,
      '#states' => [
        'visible' => [
          ':input[name="custom_annotations"]' => ['checked' => TRUE],
        ],
      ],
    ];

    $form['default_styles'] = [
      '#type' => 'fieldset',
      '#title' => $this->t('Default Styles for Annotations'),
      '#description' => $this->t('Set the default styles for annotations. Annotations without tags and style tags will inherit this style.'),
    ];

    $form['default_styles']['background_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Annotation Background Color'),
      '#default_value' => $config->get('recogito_integration.background_color'),
    ];

    $form['default_styles']['background_transparency'] = [
      '#type' => 'number',
      '#min' => 0,
      '#max' => 1,
      '#step' => 0.01,
      '#title' => $this->t('Annotation Background Transparency'),
      '#description' => $this->t('Set the transparency of the annotation background color. 1 is fully opaque, 0 is fully transparent.'),
      '#default_value' => $config->get('recogito_integration.background_transparency') ?? 0,
    ];

    $form['default_styles']['text_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Annotation Text Color'),
      '#description' => $this->t('The color of the annotated text. If omitted, annotated text will be the same color as un-annotated text.'),
      '#default_value' => $config->get('recogito_integration.text_color'),
    ];

    $form['default_styles']['underline_color'] = [
      '#type' => 'color',
      '#title' => $this->t('Annotation Underline Color'),
      '#default_value' => $config->get('recogito_integration.underline_color'),
    ];

    $form['default_styles']['underline_stroke'] = [
      '#type' => 'number',
      '#title' => $this->t('Annotation Underline Stroke Size (px)'),
      '#description' => $this->t('Choose 0 to omit any underlines.'),
      '#min' => 0,
      '#step' => 0.1,
      '#default_value' => $config->get('recogito_integration.underline_stroke') ?? 0,
    ];

    $form['default_styles']['underline_style'] = [
      '#type' => 'select',
      '#title' => $this->t('Annotation Underline Style'),
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
      '#default_value' => $config->get('recogito_integration.underline_style') ?? 'none',
    ];

    $vocabularies = Vocabulary::loadMultiple();
    $vocabulary_options = ['' => '-- Select --'];
    foreach ($vocabularies as $vocabulary) {
      $vocabulary_options[$vocabulary->id()] = $vocabulary->label();
    }

    $form['tag_set'] = [
      '#type' => 'fieldset',
      '#title' => $this->t('Pick a vocabulary to serve for tagging.'),
    ];

    $config_vocab = $config->get('recogito_integration.vocabulary_name');
    $lockedSelection = $this->hasTags($config_vocab ?? '');
    $tag_description = $lockedSelection ?
      $this->t('Tag switching is disabled! Please delete existing annotation textualbody tags to switch vocabulary!') :
      $this->t('Select the vocabulary for tagging.<br>WARNING: Any non-existent tags entered during annotating will be created within this vocabulary as a taxonomy term!');
    $form['tag_set']['vocabulary_name'] = [
      '#type' => 'select',
      '#title' => $this->t('Annotation Vocabulary Name'),
      '#options' => $vocabulary_options,
      '#default_value' => $config_vocab ?? '',
      '#disabled' => $lockedSelection,
      '#ajax' => [
        'callback' => '::vocabularyCallback',
        'wrapper' => 'term_settings_container',
      ],
      '#description' => $tag_description,
      '#required' => TRUE,
    ];

    $form['tag_set']['tag_text_input'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Enable tag text input for new tags.'),
      '#description' => $this->t('If enabled, users can input new tags during annotation creation given that the tag creation option is enabled.'),
      '#default_value' => $config->get('recogito_integration.tag_text_input') ?? 1,
    ];

    $form['tag_set']['tag_selector'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Enable tag selection for existing tags.'),
      '#description' => $this->t('If enabled, users can select existing tags during annotation creation. This input does not support tag creation.'),
      '#default_value' => $config->get('recogito_integration.tag_selector') ?? 0,
    ];

    $form['tag_set']['preview_tag_selector'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Preview tag styling in tag selector.'),
      '#description' => $this->t('If enabled, the tag selector will display the tag styling in the dropdown.'),
      '#default_value' => $config->get('recogito_integration.preview_tag_selector') ?? 0,
    ];

    $form['tag_set']['term_settings_container'] = [
      '#type' => 'container',
      '#attributes' => ['id' => 'term_settings_container'],
    ];

    $current_value = $form_state->getValue('vocabulary_name');
    $selected_vocab = $current_value ?? $config_vocab;
    if (($current_value === NULL && $config_vocab ?? FALSE) || $current_value) {
      $form['tag_set']['term_settings_container']['create_nonexistent_tag'] = [
        '#type' => 'checkbox',
        '#title' => $this->t('Enable tag creation for non-existent tags.'),
        '#description' => $this->t('If enabled, users can create new tags during annotation creation. Only supports raw tag text input!'),
        '#default_value' => $config->get('recogito_integration.create_nonexistent_tag') ?? 1,
      ];
      $form['tag_set']['term_settings_container']['default_tag'] = [
        '#type' => 'select',
        '#multiple' => TRUE,
        '#title' => $this->t('Select Default Tags'),
        '#options' => $this->loadTags($selected_vocab),
        '#default_value' => $config->get('recogito_integration.default_tag') ?? [],
        '#description' => $this->t('Select the default tag assigned to newly created annotation!'),
      ];
    }
    $form['#validate'][] = '::validateVocabularyName';
    return $form;
  }

  /**
   * Validate the vocabulary name.
   *
   * @param array $form
   *   The form array.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   */
  public function validateVocabularyName(array &$form, FormStateInterface $form_state) {
    $vocabulary_name = $form_state->getValue('vocabulary_name');
    if ($vocabulary_name === '') {
      $form_state->setErrorByName('vocabulary_name', $this->t('Please select a vocabulary.'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $config = $this->config('recogito_integration.settings');
    $content_types = $this->entityTypeManager->getStorage('node_type')->loadMultiple();
    $config_content = $config->get('recogito_integration.annotatables') ?? [];
    $config_new = [];
    foreach ($content_types as $ct) {
      $id = $ct->id();
      if ($id != 'annotation') {
        $config_new[$id] = $config_content[$id] ?? [];
        $config_new[$id]['enabled'] = $form_state->getValue($id . '_annotatable') ?? 0;
        if ($config_new[$id]['enabled']) {
          $config_new[$id]['fields'] = $form_state->getValue($id . '_annotatable_fields') ?? [];
        }
        if (!isset($config_new[$id]['fields'])) {
          $config_new[$id]['fields'] = [];
        }
      }
    }
    $config->set('recogito_integration.annotatables', $config_new);
    $config->set('recogito_integration.custom_annotations', $form_state->getValue('custom_annotations'));
    if ($form_state->getValue('custom_annotations')) {
      $config->set('recogito_integration.custom_annotations_elements', $form_state->getValue('custom_annotations_elements'));
    }
    $config->set('recogito_integration.background_color', $form_state->getValue('background_color'));
    $config->set('recogito_integration.background_transparency', $form_state->getValue('background_transparency'));
    $config->set('recogito_integration.text_color', $form_state->getValue('text_color'));
    $config->set('recogito_integration.underline_color', $form_state->getValue('underline_color'));
    $config->set('recogito_integration.underline_stroke', $form_state->getValue('underline_stroke'));
    $config->set('recogito_integration.underline_style', $form_state->getValue('underline_style'));
    $config->set('recogito_integration.vocabulary_name', $form_state->getValue('vocabulary_name'));
    $config->set('recogito_integration.tag_text_input', $form_state->getValue('tag_text_input'));
    $config->set('recogito_integration.tag_selector', $form_state->getValue('tag_selector'));
    $config->set('recogito_integration.preview_tag_selector', $form_state->getValue('preview_tag_selector'));
    $config->set('recogito_integration.default_tag', $form_state->getValue('default_tag') ?? []);
    $config->set('recogito_integration.create_nonexistent_tag', $form_state->getValue('create_nonexistent_tag') ?? 1);
    $config->save();
    if ($config_new != $config_content) {
      $this->cacheTagsInvalidator->invalidateTags(['rendered']);
    }
    return parent::submitForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames() {
    return [
      'recogito_integration.settings',
    ];
  }

}
