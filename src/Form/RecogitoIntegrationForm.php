<?php

namespace Drupal\recogito_integration\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

class RecogitoIntegrationForm extends ConfigFormBase
{

  /**
   * {@inheritdoc}
   */
  public function getFormId()
  {
    return 'recogito_integration_form';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state)
  {
    $form = parent::buildForm($form, $form_state);
    $config = $this->config('recogito_integration.settings');

    // pull list of exsiting content types of the site
    $content_types = \Drupal::entityTypeManager()
      ->getStorage('node_type')
      ->loadMultiple();
    $options_contentypes = array();
    foreach ($content_types as $ct) {
      if (!in_array($ct->id(), ['annotation_collection', 'annotation', 'annotation_textualbody'])) {
        $options_contentypes[$ct->id()] = $ct->label();
      }
    }

    $form['set-permission'] = array(
      '#markup' => $this->t("<p><strong>For permission, please configure which user(s) can create, update, and delete annotation for content at <a href='/admin/people/permissions'>here</a></strong>.</p>")
    );

    $form['select-content-types'] = array(
      '#type' => 'checkboxes',
      '#title' => t('Which content type(s) to be annotated:'),
      '#options' => $options_contentypes,
      '#default_value' => ($config->get('recogito_integration.content-type-to-annotated') !== null) ? array_keys(array_filter($config->get('recogito_integration.content-type-to-annotated'))) : [],
    );

    $form['custom-annotation'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Custom'),
      '#ajax' => [
        'callback' => '::customModeCallback',
        'wrapper' => 'container-custom-mode',
        'effect' => 'fade',
      ],
      '#default_value' => ($config->get('recogito_integration.custom_dom') !== null) ? $config->get('recogito_integration.custom_dom') : 0,
    ];


    // Wrap textfields in a container. This container will be replaced through
    // AJAX.
    $form['custom_mode_container'] = [
      '#type' => 'container',
      '#attributes' => ['id' => 'container-custom-mode'],
    ];

    if (($form_state->getValue('custom-annotation', NULL) === null && $config->get('recogito_integration.custom_dom') !== null && $config->get('recogito_integration.custom_dom') === 1) || $form_state->getValue('custom-annotation', NULL) === 1) {
      $form['custom_mode_container']['textfields'] = [
        '#type' => 'fieldset',
        '#title' => $this->t("Custom annotation configuration for HTML elements"),
      ];
      $form['custom_mode_container']['textfields']['attach_attribute_name'] = [
        '#type' => 'textarea',
        '#title' => $this->t('List of specific DOM Element(s) to attach the Recogito JS library to:'),
        '#default_value' => $config->get('recogito_integration.attach_attribute_name'),
        '#description' => $this->t('<strong><u>Note:</u></strong> One element per line. If it\'s class name, use dot("."). If it\'s ID, use "#". <br /><strong>For example:</strong> <br />.content<br />.body<br />#article-1<br />#article-2'),
      ];
    }

    /*$form['attach_attribute_type'] = [
      '#type' => 'select',
      '#title' => $this->t('Recogito Integration DOM Element Type:'),
      '#options' => [
        'id' => $this->t('id'),
        'class' => $this->t('class'),
      ],
      '#default_value' => $config->get('recogito_integration.attach_attribute_type'),
      '#description' => $this->t('The type of attribute to attach the recogito JS library to. May only be an id or a class.'),
    ];

    $form['attach_attribute_name'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Recogito Integration DOM Element Name:'),
      '#default_value' => $config->get('recogito_integration.attach_attribute_name'),
      '#description' => $this->t('The name of the attribute to attach the recogito JS library to. Do not enter attribute identifiers such as . or #. For example, to attach to the class \'main\' you would enter \'main\'.'),
    ];*/

    /*$form['annotation_vocab_name'] = [
     '#type' => 'textarea',
     '#title' => $this->t('Annotation Vocabulary Name:'),
     '#default_value' => $config->get('recogito_integration.annotation_vocab_name'),
     '#description' => $this->t('The name of the vocabulary to pass annotation tags to and from. Leave blank if you do not wish to use this feature.'),
   ];*/

    /* Kyle replace preset dropdown list instead of text area for convenience */
    $vocabularies = \Drupal\taxonomy\Entity\Vocabulary::loadMultiple();
    $options_taxonomy = array();
    foreach ($vocabularies as $vocal) {
      $options_taxonomy[$vocal->id()] = $vocal->label();
    }
    $form['annotation_vocab_name'] = array(
      '#type' => 'radios',
      '#title' => $this->t('Annotation Vocabulary Name:'),
      '#options' => $options_taxonomy,
      '#default_value' => $config->get('recogito_integration.annotation_vocab_name'),
    );

    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state)
  {

  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state)
  {
    $config = $this->config('recogito_integration.settings');
    $config->set('recogito_integration.initialsetup', true);
    if ($form_state->getValues()['custom-annotation'] === 1 && $form_state->getValue('attach_attribute_name') !== null)  {
      $config->set('recogito_integration.attach_attribute_name', $form_state->getValue('attach_attribute_name'));
    }
    $config->set('recogito_integration.custom_dom', $form_state->getValues()['custom-annotation']);
    if ($form_state->getValues()['custom-annotation'] === 0) {
      $config->set('recogito_integration.attach_attribute_name', "");
    }
    $config->set('recogito_integration.content-type-to-annotated', $form_state->getValues()['select-content-types']);
    $config->set('recogito_integration.annotation_vocab_name', $form_state->getValue('annotation_vocab_name'));
    $config->save();
    return parent::submitForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames()
  {
    return [
      'recogito_integration.settings',
    ];
  }

  /**
   * Callback for ajax_example_autotextfields.
   *
   * Selects the piece of the form we want to use as replacement markup and
   * returns it as a form (renderable array).
   */
  public function customModeCallback($form, FormStateInterface $form_state)
  {
    return $form['custom_mode_container'];
  }


}
