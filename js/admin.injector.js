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
  attachTagsEvent(domObj, settings.tagOptions);
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
  let tagSelector = settings.tagOptions.selector;
  let tagTextEntry = settings.tagOptions.textInput;
  let createTag = settings.tagOptions.createNewTag;
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
    readOnly: !perms['create'],
    allowEmpty: false,
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
      setTimeout(() => readOnlyText(), 3);
      return;
    }
    setTimeout(() => updateMenuByPermissions(settings, annotation), 3);
    if (!tagTextEntry) {
      setTimeout(() => hideTagInput(), 3);
    }
    if (tagSelector) {
      setTimeout(() => attachTagSelector(tagList), 3);
    }
    setTimeout(() => attachTagList(settings.tagOptions), 3);
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
    if (!createTag) {
      removeNonExistentTags(annotation, tagList);
    }
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
      if (!createTag) {
        removeNonExistentTags(annotation, tagList);
      }
      annotation.type = 'Text';
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
 * Update the tag functionality based on the changes in the DOM.
 * 
 * @param {object} domObj 
 * @param {object} defaultTags 
 */
function attachTagsEvent(domObj, tagOptions) {
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
            if (tagOptions.defaultTags.length > 0) {
              setTimeout(() => attachDefaultTags(tagOptions.defaultTags), 3);
            }
            if (!tagOptions.textInput) {
              setTimeout(() => hideTagInput(), 3);
            }
            if (tagOptions.selector) {
              setTimeout(() => attachTagSelector(tagOptions.tagList), 3);
            }
            setTimeout(() => attachTagList(tagOptions), 3);
          }
        }
      }
    }
  });
  observer.observe(domObj[0], { childList: true, subtree: true });
}

/**
 * Attach the tag list of the editor to remove duplicates or monitor list for tag selector.
 */
function attachTagList(tagOptions) {
  let tagObject = $('#page').find('.r6o-tag').first();
  let tagList = tagOptions.tagList;
  let createTag = tagOptions.createNewTag;
  let selector = tagOptions.selector;
  let selectorList = $('#page').find('.r6o-tag-lister').first();
  let observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'LI') {
            let tagContent = node.querySelector('span.r6o-label')?.textContent;
            if (!tagContent) {
              return;
            }
            if (!createTag && !tagList.includes(tagContent)) {
              node.remove();
            }
            if (isInCurrentTags(tagContent)) {
              node.remove();
            }
            if (selector) {
              let option = selectorList.find('.r6o-tag-option').find(`div:contains('${tagContent}')`).first().parent();
              option.find('.r6o-tag-add').hide();
              option.find('.r6o-tag-remove').show();
            }
          }
        });
        if (selector) {
          mutation.removedNodes.forEach(function(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }
            if (node.tagName === 'LI') {
              let tagContent = node.querySelector('span.r6o-label')?.textContent;
              if (!tagContent) {
                return;
              }
              let option = selectorList.find('.r6o-tag-option').find(`div:contains('${tagContent}')`).first().parent();
              option.find('.r6o-tag-add').show();
              option.find('.r6o-tag-remove').hide();
            }
            else if (node.tagName === 'UL') {
              let tag = node.querySelector('li span.r6o-label');
              if (tag) {
                let tagContent = tag.textContent;
                let option = selectorList.find('.r6o-tag-option').find(`div:contains('${tagContent}')`).first().parent();
                option.find('.r6o-tag-add').show();
                option.find('.r6o-tag-remove').hide();
              }
            }
          });
        }
      }
    });
  });
  observer.observe(tagObject[0], { childList: true, subtree: true });
}

/**
 * Check if the tag is in the current list of tags from the tag list.
 */
function isInCurrentTags(tag) {
  let found = false;
  $('#page').find('.r6o-taglist').find('li:not(:last)').each(
    function() {
      if ($(this).find('.r6o-label').first().text() == tag) {
        found = true;
        return;
      }
    }
  );
  return found;
}

/**
 * Fetch the current list of tags from the tag list
 * 
 * @returns {array} tags
 */
function fetchCurrentTags() {
  let tags = [];
  $('#page').find('.r6o-taglist').find('li').each(
    function() {
      tags.push($(this).find('.r6o-label').first().text());
    }
  );
  return tags;
}

/**
 * Remove non-existent tags from the annotation.
 * 
 * @param {object} annotation
 */
function removeNonExistentTags(annotation, tags) {
  let newList = [];
  for (let body of annotation.body) {
    if (body.purpose === 'tagging' && tags.includes(body.value)) {
      newList.push(body);
    }
    else if (body.purpose !== 'tagging') {
      newList.push(body);
    }
  }
  annotation.body = newList;
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
 * Submits tags to the tagging input box.
 * 
 * @param {object} inputBox 
 * @param {string} tag 
 */
function submitTag(inputBox, tag) {
  let entryDom = inputBox.get(0);
  return new Promise((resolve) => {
    inputBox.val(tag);
    entryDom.dispatchEvent(new InputEvent('input'));
    resolve();
  }).then(() => {
    entryDom.dispatchEvent(new KeyboardEvent('keydown', {which: 13}));
  });
}

/**
 * Remove tag in the tagging list.
 * 
 * @param {string} tag
 */
function removeTag(tag) {
  $('#page').find('.r6o-taglist').find('li').each(function() {
    if ($(this).find('.r6o-label').first().text() == tag) {
      $(this).find('.r6o-delete-wrapper').first().click();
    }
  });
}

/**
 * Attach default tags to the annotations.
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
  let tagEntry = $('#page').find('.r6o-autocomplete').find('input').first();
  let promiseChain = Promise.resolve();
  for (let i in defaultTags) {
    promiseChain = promiseChain.then(() => {
      return submitTag(tagEntry, defaultTags[i]);
    });
  }
}

/**
 * Attach the tag selector to the annotations.
 * 
 * @param {array} tags
 */
function attachTagSelector(tags) {
  let button = $('<button class="r6o-tag-button r6o-btn">Select Tag to Add</button>');
  let selector = $('<div class="r6o-tag-selector"></div>');
  let search = $('<input type="text" placeholder="Search tag..." class="r6o-tag-search">');
  search.on('input', function() {
    let value = $(this).val().toLowerCase();
    selector.find('.r6o-tag-option').each(function() {
      let text = $(this).find('div').text().toLowerCase();
      if (text.includes(value)) {
        $(this).show();
      }
      else {
        $(this).hide();
      }
    });
  });
  selector.append(search);
  let tagList = $('<div class="r6o-tag-lister"></div>');
  let currentTag = fetchCurrentTags();
  let tagEntry = $('#page').find('.r6o-autocomplete').find('input').first();
  $.each(tags, function(index, value) {
    let option = $(`<label class="r6o-tag-option">
    <div>${value}</div>
    </label>`);
    let addOption = $('<button class="r6o-tag-add r6o-btn">Add</button>');
    let removeOption = $('<button class="r6o-tag-remove r6o-btn">Remove</button>');
    option.append(addOption);
    if (currentTag.includes(value)) {
      addOption.hide();
    }
    option.append(removeOption);
    removeOption.hide();
    if (currentTag.includes(value)) {
      removeOption.show();
    }
    tagList.append(option);

    option.on('click', function(event) {
      event.preventDefault();
      if (addOption.is(':visible')) {
        submitTag(tagEntry, value);
        addOption.hide();
        removeOption.show();
      } else if (removeOption.is(':visible')) {
        removeTag(value);
        removeOption.hide();
        addOption.show();
      }
    });
  });

  selector.append(tagList);
  button.on('click', function(event) {
    event.stopPropagation();
    selector.toggle();
  });

  selector.on('click', function(event) {
    event.stopPropagation();
  });

  $(document).on('click', function(event) {
    if (!$(event.target).hasClass('r6o-delete-wrapper')) {
      selector.hide();
    }
  });

  $('#page').find('.r6o-autocomplete div').first().append(button).append(selector);
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
 * Hide the text input for tags.
 */
function hideTagInput() {
  $('#page').find('.r6o-autocomplete div').find('input').hide();
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
  let tagSelector = settings.tagOptions.selector;
  let tagTextEntry = settings.tagOptions.textInput;
  let createTag = settings.tagOptions.createNewTag;
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
    readOnly: !perms['create'],
    allowEmpty: false,
  });
  imgAnnotation.setAuthInfo(userData);
  imgAnnotation.target = target;
  imgAnnotation.targetSrc = imgObj[0]['src'];
  if (!imageAnnotations[imgAnnotation.target]) {
    imageAnnotations[imgAnnotation.target] = [];
  }
  imageAnnotations[imgAnnotation.target].push(imgAnnotation);

  imgAnnotation.on('selectAnnotation', function(annotation) {
    clearSelectedForImage(annotation.id);
    setTimeout(() => updateMenuByPermissions(settings, annotation), 3);
    if (!tagTextEntry) {
      setTimeout(() => hideTagInput(), 3);
    }
    if (tagSelector) {
      setTimeout(() => attachTagSelector(tagList), 3);
    }
    setTimeout(() => attachTagList(settings.tagOptions), 3);
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
    if (!createTag) {
      removeNonExistentTags(annotation, tagList);
    }
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
      if (!createTag) {
        removeNonExistentTags(annotation, tagList);
      }
      annotation.type = 'Image';
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
 * Clear all selected annotations but for image annotation selects. Treat each as cancel button click.
 * 
 * @param {string} annotationId
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