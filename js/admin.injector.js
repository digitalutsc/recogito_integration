let imageAnnotations = {};
const MAX_TAG_LENGTH = '150';
let textAnnotations = {};
let $ = jQuery;

/**
 * Converts a hexadecimal color code into the corresponding RGBA string. 
 * Credit:  https://stackoverflow.com/a/21648508
 *
 * @param {string} hex the hex color code
 * @returns the RGBA representation of hex
 */
function hexToRgbA(hex, transparency = 1){
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

$(document).ready(function () { 
  let perms = drupalSettings.recogito_integration.permissions;
  let isAdmin = drupalSettings.recogito_integration.admin;
  if (!isAdmin) {
    return;
  }
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
  attachDefaultTagsEvent(domObj, settings.tagOptions.defaultTags);
}

/**
 * Initialize Recogito for the particular jQuery object.
 * 
 * @param {object} domObj 
 * @param {object} settings 
 */
function initRecogito(domObj, settings) {
  let userData = settings.userData;
  let tagList = settings.tagOptions.tagList;
  let defaultTags = settings.tagOptions.defaultTags;
  let perms = settings.permissions;
  let target = settings.current_target;
  domObj.css({
    'background-color': '#dfeaff',
  });
  let txtAnnotation = Recogito.init({
    content: domObj[0],
    locale: 'auto',
    widgets: [
      'COMMENT',
      {widget: 'TAG',
      vocabulary: tagList,
      textPlaceHolder: 'Add tags by typing here and pressing Enter...'}
    ],
    readOnly: !perms['create']
  });
  txtAnnotation.setAuthInfo(userData);
  txtAnnotation.target = target;
  if (!textAnnotations[txtAnnotation.target]) {
    textAnnotations[txtAnnotation.target] = [];
  }
  textAnnotations[txtAnnotation.target].push(txtAnnotation);

  txtAnnotation.on('selectAnnotation', function(annotation) {
    clearSelected();
    let editable = perms['edit'] || (perms['edit-own'] && userData['id'] === annotation.body[0].creator.id);
    if (!editable) {
      setTimeout(() => readOnlyText, 3);
      return;
    }
    setTimeout(() => updateMenuByPermissions(settings, annotation), 3);
  });

  txtAnnotation.on('createAnnotation', function(annotation) {
    if (!perms['create']) {
      alert('You do not have permission to create annotations.');
      txtAnnotation.removeAnnotation(annotation);
      return;
    }
    appendDefaultTags(annotation, defaultTags);
    annotation.target_element = target;
    removeDuplicateTags(annotation);
    annotation.node_id = settings.nodeId;
    annotation.type = 'Text';
    createAnnotation(annotation);
  });

  txtAnnotation.on('updateAnnotation', function(annotation, previous) {
    if (!perms['edit'] && !perms['edit-own']) {
      alert('You do not have permission to update annotations.');
      txtAnnotation.removeAnnotation(annotation);
      addAnnotation(txtAnnotation, previous);
      return;
    }
    if (!perms['edit'] && perms['edit-own'] && userData['id'] !== annotation.body[0].creator.id) {
      alert('You cannot edit as this annotation was created by another user.');
      txtAnnotation.removeAnnotation(annotation);
      addAnnotation(txtAnnotation, previous);
      return;
    }
    if (JSON.stringify(annotation) !== JSON.stringify(previous)) {
      removeDuplicateTags(annotation);
      updateAnnotation(annotation);
      return;
    }
    applyStyle(annotation.id, annotation.style);
  });

  txtAnnotation.on('deleteAnnotation', function(annotation) {
    if (!perms['delete'] && !perms['delete-own']) {
      alert('You do not have permission to delete annotations.');
      addAnnotation(txtAnnotation, annotation);
      return;
    }
    if (!perms['delete'] && perms['delete-own'] && userData['id'] !== annotation.body[0].creator.id) {
      alert('You cannot delete as this annotation was created by another user.');
      addAnnotation(txtAnnotation, annotation);
      return;
    }
    if (!confirm('Are you sure you want to delete this annotation?')) {
      addAnnotation(txtAnnotation, annotation);
      return;
    }
    deleteAnnotation(annotation);
  });
}

/**
 * Update the default tags based on the changes in the DOM.
 * 
 * @param {object} domObj 
 * @param {object} defaultTags 
 */
function attachDefaultTagsEvent(domObj, defaultTags) {
  if (defaultTags.length <= 0) {
    return;
  }
  let observer = new MutationObserver(function(mutations) {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          let isNode = node.nodeType === Node.ELEMENT_NODE && node.classList;
          if (!isNode) {
            continue;
          }
          if ((node.tagName === 'SPAN' && node.classList.contains('r6o-selection')) || 
              (node.tagName === 'g' && node.querySelector('.a9s-annotation.editable.selected[data-id="undefined"]'))) {
            clearSelected();
            setTimeout(() => attachDefaultTags(defaultTags), 3);
          }
        }
      }
    }
  });
  observer.observe(domObj[0], { childList: true, subtree: true });
}

/**
 * Remove duplicate tags from the annotation.
 * 
 * @param {object} annotation 
 */
function removeDuplicateTags(annotation) {
  let unique = [];
  let map = new Map();
  for (let body of annotation.body) {
    if (body.purpose === 'tagging' && !map.has(body.value)) {
      map.set(body.value, true);
      unique.push(body);
    }
    else if (body.purpose !== 'tagging'){
      unique.push(body);
    }
  }
  annotation.body = unique;
}

/**
 * Make the text annotation read-only. (Makeshift)
 */
function readOnlyText() {
  let editor = $('#page').find('.r6o-editor');
  editor.find('.r6o-btn.delete-annotation').remove();
  editor.find('.r6o-autocomplete').remove();
  editor.find('.r6o-widget.comment.editable').remove();
  editor.find('.r6o-taglist li').each(
    function() {
      $(this).replaceWith($(this).clone());
    }
  );
  editor.find('.r6o-icon.r6o-arrow-down').remove();
  editor.find('.r6o-btn.ok-annotation').remove();
  editor.find('.cancel-annotation').each(
    function() {
      $(this).attr('class', 'r6o-btn close-annotation');
    }
  );
}

/**
 * Update the menu based on the permissions of the user.
 * 
 * @param {object} settings 
 * @param {object} annotation 
 */
function updateMenuByPermissions(settings, annotation) {
  let perms = settings.permissions;
  let userData = settings.userData;
  let editor = $('#page').find('.r6o-editor');
  let deletable = perms['delete'] || (perms['delete-own'] && userData['id'] === annotation.body[0].creator.id);
  if (!deletable) {
    editor.find('.r6o-btn.delete-annotation').remove();
    editor.find('.r6o-icon.r6o-arrow-down').remove();
  }
}

/**
 * Attach default tags to the annotations. For visual purposes.
 * 
 * @param {object} defaultTags 
 */
function attachDefaultTags(defaultTags) {
  let element = $('#page').find('.r6o-tag').first();
  if (element.length <= 0) {
    return;
  }
  if (element.hasClass('default-tags')) {
    return;
  }
  element.addClass('default-tags');
  let ul = $('<ul>', { class: 'r6o-taglist default-tags'});
  let presetTag = $('<div>', { text: 'Preset Tags:', class: 'r6o-defaultLabel' });
  ul.prepend(presetTag);
  for (let i in defaultTags) {
    let li = $('<li>');
    let span = $('<span>', { class: 'r6o-label', text: defaultTags[i] });
    li.append(span);
    ul.append(li);
  }
  element.prepend(ul);
}

/**
 * Append default tags to the annotation.
 * 
 * @param {object} annotation
 * @param {object} defaultTags
 */
function appendDefaultTags(annotation, defaultTags) {
  if (defaultTags.length <= 0) {
    return;
  }
  let originalContent = annotation.body[0];
  for (let i in defaultTags) {
    annotation.body.push({
      created: originalContent.created,
      creator: originalContent.creator,
      modified: originalContent.modified,
      purpose: 'tagging',
      type: originalContent.type,
      value: defaultTags[i]
    });
  }
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
  let tagList = settings.tagOptions.tagList;
  let perms = settings.permissions;
  let userData = settings.userData;
  let defaultTags = settings.tagOptions.defaultTags;
  let target = settings.current_target;
  let imgAnnotation = Annotorious.init({
    image: imgObj[0],
    locale: 'auto',
    widgets: [
      'COMMENT',
      {widget: 'TAG',
      vocabulary: tagList,
      textPlaceHolder: 'Add tags by typing here and pressing Enter...'}
    ],
    readOnly: !perms['create']
  });
  imgAnnotation.setAuthInfo(userData);
  imgAnnotation.target = target;
  imgAnnotation.targetSrc = imgObj[0]['src'];
  if (!imageAnnotations[imgAnnotation.target]) {
    imageAnnotations[imgAnnotation.target] = [];
  }
  imageAnnotations[imgAnnotation.target].push(imgAnnotation);

  imgAnnotation.on('selectAnnotation', function(annotation) {
    setTimeout(() => updateMenuByPermissions(settings, annotation), 3);
  });

  imgAnnotation.on('createAnnotation', function(annotation) {
    if (!perms['create']) {
      alert('You do not have permission to create annotations.');
      imgAnnotation.removeAnnotation(annotation);
      return;
    }
    appendDefaultTags(annotation, defaultTags);
    annotation.target_element = target;
    removeDuplicateTags(annotation);
    annotation.node_id = settings.nodeId;
    annotation.type = 'Image';
    createAnnotation(annotation);
  });

  imgAnnotation.on('updateAnnotation', function(annotation, previous) {
    if (!perms['edit'] && !perms['edit-own']) {
      alert('You do not have permission to update annotations.');
      imgAnnotation.removeAnnotation(annotation);
      addImageAnnotation(imgAnnotation, previous, true);
      return;
    }
    if (!perms['edit'] && perms['edit-own'] && userData['id'] !== annotation.body[0].creator.id) {
      alert('You cannot edit as this annotation was created by another user.');
      imgAnnotation.removeAnnotation(annotation);
      addImageAnnotation(imgAnnotation, previous, true);
      return;
    }
    if (JSON.stringify(annotation) !== JSON.stringify(previous)) {
      removeDuplicateTags(annotation);
      updateAnnotation(annotation);
    }
  });

  imgAnnotation.on('deleteAnnotation', function(annotation) {
    let editable = perms['edit'] || (perms['edit-own'] && userData['id'] === annotation.body[0].creator.id);
    if (!perms['delete'] && !perms['delete-own']) {
      alert('You do not have permission to delete annotations.');
      addImageAnnotation(imgAnnotation, annotation, !editable);
      return;
    }
    if (!perms['delete'] && perms['delete-own'] && userData['id'] !== annotation.body[0].creator.id) {
      alert('You cannot delete as this annotation was created by another user.');
      addImageAnnotation(imgAnnotation, annotation, !editable);
      return;
    }
    if (!confirm('Are you sure you want to delete this annotation?')) {
      addImageAnnotation(imgAnnotation, annotation, !editable);
      return;
    }
    deleteAnnotation(annotation);
  });
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
  let perms = settings.permissions;
  let userData = settings.userData;
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
            if (textAnnotations[annotation.target_element]) {
              for (let annotationInstance of textAnnotations[annotation.target_element]) {
                addAnnotation(annotationInstance, annotation);
              }
            }
            break;
          case 'Image':
            if (imageAnnotations[annotation.target_element]) {
              for (let annotationInstance of imageAnnotations[annotation.target_element]) {
                if (annotationInstance.targetSrc === annotation.target.source) {
                  let editable = perms['edit'] || (perms['edit-own'] && userData['id'] === annotation.body[0].creator.id);
                  addImageAnnotation(annotationInstance, annotation, !editable);
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

/**
 * Create an annotation in the database.
 * 
 * @param {object} annotation 
 */
function createAnnotation(annotation) {
  let annotationData = AnnotationConverter.convertW3CToData(annotation);
  annotationData['nodeId'] = annotation.node_id;
  $.ajax({
    type: 'POST',
    url: '/recogito_integration/create',
    dataType: 'text',
    contentType: 'application/json',
    data: JSON.stringify(annotationData),
    success: function(data) {
      location.reload();
    },
    error: function(xhr, status, error) {
      alert('Unable to create the annotation: \n\n' + xhr.responseText);
      location.reload();
    }
  })
}

/**
 * Update an annotation in the database.
 * 
 * @param {object} annotation 
 */
function updateAnnotation(annotation) {
  let annotationData = AnnotationConverter.convertW3CToData(annotation);
  $.ajax({
    type: 'PUT',
    url: `/recogito_integration/update/${annotation.id.substring(1)}`,
    dataType: 'text',
    contentType: 'application/json',
    data: JSON.stringify(annotationData),
    success: function(data) {
      location.reload();
    },
    error: function(xhr, status, error) {
      alert('Unable to update the annotation: \n\n' + xhr.responseText);
      location.reload();
    }
  });
}
/**
 * Delete an annotation from the database.
 * 
 * @param {object} annotation 
 */
function deleteAnnotation(annotation) {
  $.ajax({
    type: 'DELETE',
    url: `/recogito_integration/delete/${annotation.id.substring(1)}`,
    dataType: 'text',
    success: function(data) {
      location.reload();
    },
    error: function(xhr, status, error) {
      alert('Unable to delete the annotation: \n\n' + xhr.responseText);
      location.reload();
    }
  });
}