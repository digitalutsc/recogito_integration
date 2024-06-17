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
  let tagStyleList = settings.tagOptions.tagStyleList;
  let tagSelector = settings.tagOptions.selector;
  let tagTextEntry = settings.tagOptions.textInput;
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
      setTimeout(() => readOnlyText(), 2);
      return;
    }
    setTimeout(() => {
      updateMenuByPermissions(settings, annotation);
      if (!tagTextEntry) {
        hideTagInput();
      }
      if (tagSelector) {
        attachTagSelector(tagStyleList);
      }
      attachTagList(settings.tagOptions);
      attachWrapperOk('Update');
    }, 2);
  });

  txtAnnotation.on('createAnnotation', function(annotation) {
    if (!perms['create']) {
      alert('You do not have permission to create annotations.');
      txtAnnotation.removeAnnotation(annotation);
      return;
    }
    annotation.target_element = target;
    annotation.node_id = settings.nodeId;
    annotation.type = 'Text';
    if (annotation.body.length <= 0) {
      txtAnnotation.removeAnnotation(annotation);
      return;
    }
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
      annotation.type = 'Text';
      updateAnnotation(annotation);
      return;
    }
    applyStyle(annotation.id, annotation.style);
  });

  txtAnnotation.on('deleteAnnotation', function(annotation) {
    if (!perms['delete'] && !perms['delete-own']) {
      alert('You do not have permission to delete annotations.');
      location.reload();
      return;
    }
    if (!perms['delete'] && perms['delete-own'] && userData['id'] !== annotation.body[0].creator.id) {
      alert('You cannot delete as this annotation was created by another user.');
      location.reload();
      return;
    }
    if (!confirm('Are you sure you want to delete this annotation?')) {
      location.reload();
      return;
    }
    deleteAnnotation(annotation);
  });
}

/**
 * Attach a wrapper Annotate button in place of the OK button.
 *
 * @param {string} btnText
 */
function attachWrapperOk(btnText = 'Annotate') {
  let footer = $('#page').find('.r6o-footer');
  footer.find('.ok-annotation').first().hide();
  let wrapperOk = $(`<button class="r6o-btn ok-annotation">${btnText}</button>`);
  wrapperOk.on('click', function(event) {
    let tagEntry = $('#page').find('.r6o-autocomplete').find('input').first();
    return new Promise((resolve) => {
      tagEntry.val('');
      tagEntry.get(0).dispatchEvent(new InputEvent('input'));
      resolve();
    }).then(() => {
      setTimeout(() => {
        footer.find('.ok-annotation:hidden').first().click();
      }, 1);
    });
  });
  footer.append(wrapperOk);
}

/**
 * Update the tag functionality based on the changes in the DOM.
 *
 * @param {object} domObj
 * @param {object} defaultTags
 */
function attachTagsEvent(domObj, tagOptions) {
  let observer = new MutationObserver(function(mutations) {
    let attached = false;
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          let isNode = node.nodeType === Node.ELEMENT_NODE && node.classList;
          if (!isNode) {
            continue;
          }
          if (attached) {
            return;
          }
          if ((node.tagName === 'SPAN' && node.classList.contains('r6o-selection')) ||
              (node.tagName === 'g' && node.querySelector('.a9s-annotation.editable.selected[data-id="undefined"]'))) {
            attached = true;
            clearSelected();
            setTimeout(() => {
              if (tagOptions.defaultTags.length > 0) {
                attachDefaultTags(tagOptions.defaultTags);
              }
              if (!tagOptions.textInput) {
                hideTagInput();
              }
              if (tagOptions.selector) {
                attachTagSelector(tagOptions.tagStyleList);
              }
              attachTagList(tagOptions);
              attachWrapperOk();
            }, 2);
          }
        }
      }
    }
  });
  observer.observe(domObj[0], { childList: true, subtree: true });
}

/**
 * Show/Hide the buttons in the tag list for a specific tag.
 *
 * @param {object} listOptions
 * @param {string} tag
 * @param {boolean} adding
 */
function selectorListToggle(listOptions, tag, adding) {
  let option = listOptions.find(`div[selector-tag='${tag}']`);
  if (option.length <= 0) {
    return;
  }
  let parent = option.first().parent();
  if (adding) {
    parent.find('.r6o-tag-add').hide();
    parent.find('.r6o-tag-remove').show();
    return;
  }
  parent.find('.r6o-tag-add').show();
  parent.find('.r6o-tag-remove').hide();
}

/**
 * Attach the tag list of the editor to remove duplicates or monitor list for tag selector.
 *
 * @param {object} tagOptions
 */
function attachTagList(tagOptions) {
  let tagObject = $('#page').find('.r6o-tag').first();
  let tagList = tagOptions.tagList;
  let createTag = tagOptions.createNewTag;
  let selector = tagOptions.selector;
  let listOptions = $('#page').find('.r6o-tag-lister').first().find('.r6o-tag-option');
  let observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }
          let tagContent = null;
          if (node.tagName === 'LI') {
            tagContent = node.querySelector('span.r6o-label')?.textContent;
          }
          else if (node.tagName === 'UL') {
            tagContent = node.querySelector('li span.r6o-label')?.textContent;
          }
          if (!tagContent) {
            return;
          }
          if (!createTag && !tagList.includes(tagContent)) {
            removeTag(tagContent);
          }
          if (isInCurrentTags(tagContent, false)) {
            removeTag(tagContent);
          }
          if (selector) {
            selectorListToggle(listOptions, tagContent, true);
          }
        });
        if (selector) {
          mutation.removedNodes.forEach(function(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return;
            }
            let tagContent = null;
            if (node.tagName === 'LI') {
              tagContent = node.querySelector('span.r6o-label')?.textContent;
            }
            else if (node.tagName === 'UL') {
              tagContent = node.querySelector('li span.r6o-label')?.textContent;
            }
            if (!tagContent || isInCurrentTags(tagContent, true)) {
              return;
            }
            selectorListToggle(listOptions, tagContent, false);
          });
        }
      }
    });
  });
  observer.observe(tagObject[0], { childList: true, subtree: true });
}

/**
 * Check if the tag is in the current list of tags from the tag list.
 *
 * @param {string} tag
 * @param {boolean} last
 *
 * @returns {boolean}
 */
function isInCurrentTags(tag, last) {
  let found = false;
  let queryString = 'li';
  if (!last) {
    queryString += ':not(:last)';
  }
  $('#page').find('.r6o-taglist').find(queryString).each(function() {
    if ($(this).find('.r6o-label').first().text() == tag) {
      found = true;
      return;
    }
  });
  return found;
}

/**
 * Fetch the current list of tags from the tag list
 *
 * @returns {array}
 */
function fetchCurrentTags() {
  let tags = [];
  $('#page').find('.r6o-taglist').find('li').each(function() {
    tags.push($(this).find('.r6o-label').first().text());
  });
  return tags;
}

/**
 * Make the text annotation read-only. (Makeshift)
 */
function readOnlyText() {
  let editor = $('#page').find('.r6o-editor');
  editor.find('.r6o-btn.delete-annotation').remove();
  editor.find('.r6o-autocomplete').remove();
  editor.find('.r6o-widget.comment.editable').remove();
  editor.find('.r6o-taglist li').each(function() {
    $(this).replaceWith($(this).clone());
  });
  editor.find('.r6o-icon.r6o-arrow-down').remove();
  editor.find('.r6o-btn.ok-annotation').remove();
  editor.find('.cancel-annotation').each(function() {
    $(this).attr('class', 'r6o-btn close-annotation');
  });
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
    setTimeout(() => {
      entryDom.dispatchEvent(new KeyboardEvent('keydown', {which: 13}));
    }, 1);
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
  if (tags.length <= 0) {
    tagList.text('No tags available.');
  }
  $.each(tags, function(index, value) {
    let option = $(`<label class="r6o-tag-option"></label>`);
    let label = $(`<div selector-tag="${value['name']}">${value['name']}</div>`);
    if (value['hasStyle']) {
      label.css({
        'background-color': hexToRgbA(value['style']['background_color'], value['style']['background_transparency']),
        'color': value['style']['text_color'],
        'border-bottom': `${value['style']['underline_stroke']}px ${value['style']['underline_style']} ${hexToRgbA(value['style']['underline_color'])}`
      });
    }
    option.append(label);
    let addOption = $('<button class="r6o-tag-add r6o-btn">Add</button>');
    let removeOption = $('<button class="r6o-tag-remove r6o-btn">Remove</button>');
    option.append(addOption);
    if (currentTag.includes(value['name'])) {
      addOption.hide();
    }
    option.append(removeOption);
    removeOption.hide();
    if (currentTag.includes(value['name'])) {
      removeOption.show();
    }
    tagList.append(option);

    option.on('click', function(event) {
      event.preventDefault();
      if (addOption.is(':visible')) {
        addOption.hide();
        removeOption.show();
        submitTag(tagEntry, value['name']);
      } else if (removeOption.is(':visible')) {
        removeOption.hide();
        addOption.show();
        removeTag(value['name']);
      }
    });
  });

  selector.append(tagList);
  button.on('click', function(event) {
    event.stopPropagation();
    selector.animate({height: 'toggle'});
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
 * Clear all selected annotations. Treat each as cancel button click.
 */
function clearSelected() {
  $('#page').find('.r6o-footer').find('.close-annotation, .cancel-annotation').each(function() {
    $(this).click();
  });
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
  let tagStyleList = settings.tagOptions.tagStyleList;
  let perms = settings.permissions;
  let userData = settings.userData;
  let tagSelector = settings.tagOptions.selector;
  let tagTextEntry = settings.tagOptions.textInput;
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
    let editable = perms['edit'] || (perms['edit-own'] && userData['id'] === annotation.body[0].creator.id);
    if (!editable) {
      return;
    }
    setTimeout(() => {
      updateMenuByPermissions(settings, annotation);
      if (!tagTextEntry) {
        hideTagInput();
      }
      if (tagSelector) {
        attachTagSelector(tagStyleList);
      }
      attachTagList(settings.tagOptions);
      attachWrapperOk('Update');
    }, 2);
  });

  imgAnnotation.on('createAnnotation', function(annotation) {
    if (!perms['create']) {
      alert('You do not have permission to create annotations.');
      imgAnnotation.removeAnnotation(annotation);
      return;
    }
    annotation.target_element = target;
    annotation.node_id = settings.nodeId;
    annotation.type = 'Image';
    if (annotation.body.length <= 0) {
      imgAnnotation.removeAnnotation(annotation);
      return;
    }
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
      annotation.type = 'Image';
      updateAnnotation(annotation);
    }
  });

  imgAnnotation.on('deleteAnnotation', function(annotation) {
    if (!perms['delete'] && !perms['delete-own']) {
      alert('You do not have permission to delete annotations.');
      location.reload();
      return;
    }
    if (!perms['delete'] && perms['delete-own'] && userData['id'] !== annotation.body[0].creator.id) {
      alert('You cannot delete as this annotation was created by another user.');
      location.reload();
      return;
    }
    if (!confirm('Are you sure you want to delete this annotation?')) {
      location.reload();
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
  $('#page').find('.r6o-editor').each(function() {
    let annotationEle = $(this).parent().parent().find(`.a9s-annotation[data-id="${annotationId}"]`);
    if (annotationEle.length <= 0) {
      $(this).find('.r6o-footer').find('.close-annotation, .cancel-annotation').each(function() {
        $(this).click();
      });
    }
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
 * Remove the duplicate tags.
 *
 * @param {object} annotation
 */
function removeDuplicateTags(annotation) {
  let bodies = annotation.body;
  let newBody = [];
  let uniqueTags = [];
  for (let body of bodies) {
    if (body.purpose === 'tagging') {
      if (!uniqueTags.includes(body.value)) {
        uniqueTags.push(body.value);
        newBody.push(body);
      }
      else {
        newBody.push(body);
      }
    }
    else if (body.purpose === 'commenting') {
      newBody.push(body);
    }
  }
  annotation.body = newBody;
  return annotation;
}

/**
 * Create an annotation in by calling the database API.
 *
 * @param {object} annotation
 */
function createAnnotation(annotation) {
  annotation = removeDuplicateTags(annotation);
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
