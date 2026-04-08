let imageAnnotations = {};
let textAnnotations = {};
let $ = jQuery;

/**
 * Converts a hexadecimal color code into the corresponding RGBA string.
 * Credit:  https://stackoverflow.com/a/21648508
 *
 * @param {string} hex the hex color code
 * @returns the RGBA representation of hex
 */
function hexToRgbA(hex, transparency = 1) {
  let c;
  transparency === null ? 0 : transparency;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c= '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+`,${transparency})`;
  }
  throw new Error('Bad Hex');
}

$(document).ready(function() {
  let perms = drupalSettings.recogito_integration.permissions;
  if (perms['view']) {
    initAnnotations(drupalSettings.recogito_integration);
  }
});

/**
 * Initialize the annotation for the entire page.
 *
 * @param {object} settings
 */
function initAnnotations(settings) {
  let customDOM = settings.custom_elements;
  let annotatables = settings.annotatable_fields;
  for (let field in annotatables) {
    settings.current_target = field;
    $(`[annotatable-field-id="${field}"]`).each(function() {
      switch ($(this).attr('annotatable-type')) {
        case 'field':
          attachAnnotations($(this), settings);
          break;

        case 'view_field':
          attachAnnotations($(this), settings);
          break;
      }
    });
  }
  for (let element of customDOM) {
    settings.current_target = element;
    $(`${element}`).each(function() {
      initComponents($(this), settings);
    });
  }
  getAnnotations(settings);
}

/**
 * Attaches annotations to jQuery Objects.
 *
 * @param {object} domObj
 * @param {object} settings
 */
function attachAnnotations(domObj, settings) {
  if (!domObj.is(':visible')) {
    return;
  }
  if (domObj.hasClass('field__item') || domObj.hasClass('field__items')) {
    initComponents(domObj, settings);
  }
  else if (domObj.find('.field__items').length > 0) {
    initComponents(domObj.find('.field__items').first(), settings);
  }
  else if (domObj.find('.field__item').length == 1) {
    initComponents(domObj.find('.field__item').first(), settings);
  }
  else {
    initComponents(domObj, settings);
  }
}

/**
 * Initialize a jQuery object with annotations based on content.
 * Image and Text annotations are handled separately.
 *
 * @param {object} domObj
 * @param {object} settings
 */
function initComponents(domObj, settings) {
  let img = $(domObj).find('img');
  if (img.length > 0) {
    img.each(function() {
      initAnnotorious($(this), settings);
    });
  }
  initRecogito(domObj, settings);
}

/**
 * Initialize Recogito for the particular jQuery object.
 *
 * @param {object} domObj
 * @param {object} settings
 */
function initRecogito(domObj, settings) {
  let target = settings.current_target;
  let txtAnnotation = Recogito.init({
    content: domObj[0],
    locale: 'auto',
    widgets: [
      'COMMENT',
      'TAG',
    ],
    readOnly: true
  });
  txtAnnotation.target = target;
  if (!textAnnotations[txtAnnotation.target]) {
    textAnnotations[txtAnnotation.target] = [];
  }
  textAnnotations[txtAnnotation.target].push(txtAnnotation);

  txtAnnotation.on('selectAnnotation', function(annotation) {
    clearSelected();
  });
}

/**
 * Clear all selected annotations. Treat each as cancel button click.
 */
function clearSelected() {
  $('#page').find('.r6o-footer').find('.close-annotation, .cancel-annotation').each(
    function() {
      $(this).click();
    }
  );
}

/**
 * Initialize Annotorious for the particular jQuery object.
 *
 * @param {object} imgObj
 * @param {object} settings
 */
function initAnnotorious(imgObj, settings) {
  let target = settings.current_target;
  let imgAnnotation = Annotorious.init({
    image: imgObj[0],
    locale: 'auto',
    widgets: [
      'COMMENT',
      'TAG',
    ],
    readOnly: true
  });
  imgAnnotation.target = target;
  imgAnnotation.targetSrc = imgObj[0]['src'];
  if (!imageAnnotations[imgAnnotation.target]) {
    imageAnnotations[imgAnnotation.target] = [];
  }
  imageAnnotations[imgAnnotation.target].push(imgAnnotation);

  imgAnnotation.on('selectAnnotation', function(annotation) {
    clearSelectedForImage(annotation.id);
  });
}

/**
 * Clear all selected annotations but for image annotation selects. Treat each as cancel button click.
 */
function clearSelectedForImage(annotationId) {
  $('#page').find('.r6o-editor').each(
    function() {
      let annotationEle = $(this).parent().parent().find(`.a9s-annotation[data-id="${annotationId}"]`);
      if (annotationEle.length <= 0) {
        $(this).find('.r6o-footer').find('.close-annotation, .cancel-annotation').each(
          function() {
            $(this).click();
          }
        );
      }
    }
  );
}

/**
 * Adds text annotation to the desire Recogito instance.
 *
 * @param {Recogito} annotationInstance
 * @param {object} annotation
 */
function addAnnotation(annotationInstance, annotation) {
  let style = annotation.style;
  annotationInstance.addAnnotation(annotation);
  applyStyle(annotation.id, style);
}

/**
 * Apply the style to the annotation by ID.
 *
 * @param {string} annotationId
 * @param {object} style
 */
function applyStyle(annotationId, style) {
  $('#page').find(`[data-id='${annotationId}']`).css({
    'background-color': hexToRgbA(style.background_color, style.background_transparency),
    'color' : style.text_color,
    'border-bottom': `${style.underline_stroke}px ${style.underline_style} ${hexToRgbA(style.underline_color)}`
  });
}

/**
 * Adds image annotation to the desire Annotorious instance.
 *
 * @param {Annotorious} annotationInstance
 * @param {object} annotation
 * @param {boolean} readOnly
 */
function addImageAnnotation(annotationInstance, annotation, readOnly) {
  annotationInstance.addAnnotation(annotation, readOnly);
}

/**
 * Get all annotations of the current page.
 *
 * @param {object} settings
 */
function getAnnotations(settings) {
  $.ajax({
    type: 'GET',
    url: '/recogito_integration/get',
    dataType: 'json',
    headers: {
      'nodeId': settings.nodeId
    },
    success: function(data) {
      data = JSON.parse(data);
      for (let content of data) {
        let annotation = AnnotationConverter.convertDataToW3C(content);
        switch (annotation.type) {
          case 'Text':
            annotation.type = 'Annotation';
            if (textAnnotations[annotation.target_element]) {
              for (let annotationInstance of textAnnotations[annotation.target_element]) {
                addAnnotation(annotationInstance, annotation);
              }
            }
            break;

          case 'Image':
            annotation.type = 'Annotation';
            if (imageAnnotations[annotation.target_element]) {
              for (let annotationInstance of imageAnnotations[annotation.target_element]) {
                if (annotationInstance.targetSrc === annotation.target.source) {
                  addImageAnnotation(annotationInstance, annotation, true);
                }
              }
            }
            break;
        }
      }
    },
    error: function(xhr, status, error) {
      alert('Unable to retrieve annotations: \n\n' + xhr.responseText);
    }
  })
}