jQuery(document).ready(function () {
  var can_read_annotations = false;
  var perms = drupalSettings.recogito_integration.permissions;
  if (drupalSettings.recogito_integration.attach_attribute_name != "" && perms['recogito view annotations'] && !window.location.pathname.includes('recogito_integration')) {
    if (typeof OpenSeadragon != "undefined" && typeof OpenSeadragon.Annotorious != "undefined" && typeof drupalSettings.islandora_open_seadragon_viewer != "undefined" && jQuery('.openseadragon-canvas').length > 0) {
      getOpenSeadragonAnnotorious(perms);

    } else {
      //setTimeout(awaitOpenSeadragonAnnotorious, 300);
      getTextAnnotation(perms);
    }
  }
});

/**
 * Setup annotation for text
 * @param perms
 */
function getTextAnnotation(perms) {
  var user_data = drupalSettings.recogito_integration.user_data;
  var strings = drupalSettings.recogito_integration.taxonomy_terms;
  var readOnly = (!perms['recogito create annotations'] && !perms['recogito edit annotations'] && !perms['recogito delete annotations'] && !perms['recogito edit own annotations'] && !perms['recogito delete own annotations'])

  // need [0] because selector returns an array instead of object
  var attach_element = jQuery("article > div.node__content > div.field--name-body");

  for (var i = 0; i < attach_element.length; i++) {
    var text_anno = Recogito.init({
      content: attach_element[i], // Element id or DOM node to attach to
      locale: 'auto',
      readonly: readOnly,
      widgets: [
        'COMMENT',
        {widget: 'TAG', vocabulary: strings}
      ],
      relationVocabulary: ['isRelated', 'isPartOf', 'isSameAs ']
    });
    text_anno.setAuthInfo({'id': user_data.id, 'displayName': user_data.displayName});
    text_anno.on('selectAnnotation', function (annotation) {
      select_annotation(annotation);
    });

    text_anno.on('createAnnotation', function (annotation) {
      create_annotation(annotation);
    });

    text_anno.on('updateAnnotation', function (annotation, previous) {
      update_annotation(annotation, previous);
    });

    text_anno.on('deleteAnnotation', function (annotation) {
      delete_annotation(annotation);
    });
  }

}


/**
 * Setup annotation for Openseadragon viewer
 *
 * @param perms
 */
function getOpenSeadragonAnnotorious(perms) {
  var user_data = drupalSettings.recogito_integration.user_data;
  var image_anno = OpenSeadragon.Annotorious(drupalSettings.islandora_open_seadragon_viewer);
  image_anno.setAuthInfo({'id': user_data.id, 'displayName': user_data.displayName});
  //window.location.hostname + "/modules/recogito_integration/recogito_integration_functions.php"
  page_url = window.location.pathname;
  jQuery.ajax({
    type: "GET",
    url: "/recogito_integration/get",
    dataType: 'json',
    headers: {
      'pageurl': page_url,
    },

    success: function (data) {
      console.log(data);
      for (annotation in data) {
        w3c = get_annotation_w3c(data[annotation]);
        if (w3c.type == "Annotation") {
          text_anno.addAnnotation(w3c);
        } else {
          image_anno.addAnnotation(w3c);
        }
      }
    },
    error: function (xhr, status, error) {
      alert(xhr.responseText);
    }
  });
  //var anno = OpenSeadragon.Annotorious(document.getElementsByClassName("openseadragon-viewer")[0]);


  image_anno.on('selectAnnotation', function (annotation) {
    select_annotation(annotation);
  });

  image_anno.on('createAnnotation', function (annotation) {
    create_annotation(annotation);
  });

  image_anno.on('updateAnnotation', function (annotation, previous) {
    console.log(annotation);
    console.log(previous);
    update_annotation(annotation, previous);
  });

  image_anno.on('deleteAnnotation', function (annotation) {
    delete_annotation(annotation);
  });
}

function awaitOpenSeadragonAnnotorious() {

}

//When selecting an annotation, remove buttons the user has insufficient permissions for
function select_annotation(a) {
  var comment_count = 0;
  var tag_list = [];
  var perms = drupalSettings.recogito_integration.permissions;
  var user_data = drupalSettings.recogito_integration.user_data;
  for (textualbody in a.body) {
    if (a.body[textualbody].purpose == 'tagging') {
      tag_list.push([a.body[textualbody].creator.name, a.body[textualbody].value]);
    } else {
      comment_count += 1;
    }
  }

  var startTimeInMs = Date.now();
  //Show and hide specific features depending on permissions
  (function loopSearch() {
    if (jQuery('.r6o-widget').length == comment_count + 2) { //Work once all comments have been loaded
      if (!perms['recogito create annotations'] && !perms['recogito edit annotations'] && !perms['recogito delete annotations'] && !perms['recogito edit own annotations'] && !perms['recogito delete own annotations']) {
        jQuery('.r6o-arrow-down').hide();
      }
      jQuery('.r6o-widget').each(function (index) {
        var commentorname = jQuery(this).find('.r6o-lastmodified-by').text();
        if (commentorname == user_data.displayName) {
          if (!perms['recogito edit own annotations'] && !perms['recogito delete own annotations']) {
            jQuery(this).find('.r6o-arrow-down').hide();
          } else if (!perms['recogito edit own annotations'] || !perms['recogito delete own annotations']) {
            jQuery(this).click(function (e) {
              if (!perms['recogito edit own annotations']) {
                jQuery(this).delay(50).find('.r6o-comment-dropdown-menu').find("li:contains('Edit')").remove();
              } else {
                jQuery(this).delay(50).find('.r6o-comment-dropdown-menu').find("li:contains('Delete')").remove();
              }
            });
          }
        } else {
          if (!perms['recogito edit annotations'] && !perms['recogito delete annotations']) {
            jQuery(this).find('.r6o-arrow-down').hide();
          } else if (!perms['recogito edit annotations'] || !perms['recogito delete annotations']) {
            jQuery(this).click(function (e) {
              if (!perms['recogito edit annotations']) {
                jQuery(this).delay(50).find('.r6o-comment-dropdown-menu').find("li:contains('Edit')").remove();
              } else {
                jQuery(this).delay(50).find('.r6o-comment-dropdown-menu').find("li:contains('Delete')").remove();
              }
            });
          }
        }
        if (jQuery(this).hasClass('editable') && !perms['recogito create annotations']) {
          jQuery(this).remove();
        }
        if (jQuery(this).hasClass('r6o-tag')) {
          if (!perms['recogito create annotations']) {
            jQuery(this).find('.r6o-autocomplete').hide();
          }
          jQuery(this).find('.r6o-taglist').children().each(function () {
            jQuery(this).click(function (e) {
              var displayed_tag = jQuery(this).find('.r6o-label').delay(50).text();
              for (internal_tag in tag_list) {
                if (tag_list[internal_tag][1] == displayed_tag) {
                  if (tag_list[internal_tag][0] == user_data.displayName) {
                    if (!perms['recogito delete own annotations']) {
                      jQuery(this).find('.r6o-delete-wrapper').hide();
                    }
                  } else if (!perms['recogito delete annotations']) {
                    jQuery(this).find('.r6o-delete-wrapper').hide();
                  }
                }
              }
            });
          });
        }
      });
      jQuery('.delete-annotation').hide();
      return;
    } else {
      setTimeout(function () {
        loopSearch();
      }, 50);
    }
  })();
}

//Create an annotation within Drupal, given W3C data
function create_annotation(a) {
  var annotation_obj = get_annotation_object(a);
  jQuery.ajax({
    type: "POST",
    url: "/recogito_integration/create",
    dataType: 'text',
    headers: {
      'pageurl': page_url,
      'annotationobj': JSON.stringify(annotation_obj)
    },

    success: function (data) {
      console.log(data);
    },
    error: function (xhr, status, error) {
      alert(xhr.responseText);
    }
  });
}

//Update an annotation in Drupal, given W3C data
function update_annotation(annotation, previous) {
  var annotation_obj = get_annotation_object(annotation);
  jQuery.ajax({
    type: "POST",
    url: "/recogito_integration/update",
    dataType: 'text',
    headers: {
      'annotationobj': JSON.stringify(annotation_obj)
    },

    success: function (data) {
      console.log(data);
    },
    error: function (xhr, status, error) {
      alert(xhr.responseText);
    }
  });
}

//Delete an annotation from Drupal, given W3C data
function delete_annotation(annotation) {
  var annotation_obj = get_annotation_object(annotation);
  jQuery.ajax({
    type: "DELETE",
    url: "/recogito_integration/delete",
    dataType: 'text',
    headers: {
      'annotationobj': JSON.stringify(annotation_obj)
    },

    success: function (data) {
      console.log(data);
    },
    error: function (xhr, status, error) {
      alert(xhr.responseText);
    }
  });
}

//Convert a W3C annotation object to an object containing the bare minimum of data to store
function get_annotation_object(a) {
  var annotation_object = {};
  annotation_object.textualbodies = [];
  for (textualbody in a.body) {
    newtextualbody = {};
    newtextualbody.created = a.body[textualbody].created;
    newtextualbody.creator_id = a.body[textualbody].creator.id;
    newtextualbody.creator_name = a.body[textualbody].creator.name;
    newtextualbody.modified = a.body[textualbody].modified;
    newtextualbody.purpose = a.body[textualbody].purpose;
    newtextualbody.value = a.body[textualbody].value;
    annotation_object.textualbodies.push(newtextualbody);
  }
  annotation_object.id = a.id;
  if (Array.isArray(a.target.selector)) { //Textual Annotations
    for (selector in a.target.selector) {
      if (a.target.selector[selector].type == 'TextQuoteSelector') {
        annotation_object.target_exact = a.target.selector[selector].exact;
      } else if (a.target.selector[selector].type == 'TextPositionSelector') {
        annotation_object.target_start = a.target.selector[selector].start;
        annotation_object.target_end = a.target.selector[selector].end;
        annotation_object.type = "Annotation";
      }
    }
  } else { //Image annotations
    annotation_object.type = "Selection";
    annotation_object.image_value = a.target.selector.value
    annotation_object.image_source = a.target.source
  }
  annotation_object.title = annotation_object.id;
  return annotation_object;
}

//Convert an object with only stored data to a W3C object to pass to the library
function get_annotation_w3c(annotation_object) {
  var annotation_w3c = {};
  annotation_w3c['@context'] = "http://www.w3.org/ns/anno.jsonld";
  annotation_w3c.id = annotation_object.id[0].value;
  annotation_w3c.target = {selector: []};
  if (annotation_object.type[0].value == "Selection") {
    annotation_w3c.target.selector = {
      conformsTo: "http://www.w3.org/TR/media-frags/",
      type: "FragmentSelector",
      value: annotation_object.image_value[0].value,
    };
    annotation_w3c.target.source = annotation_object.image_source[0].value;
    annotation_w3c.type = "Selection";
  } else {
    annotation_w3c.type = "Annotation";
    annotation_w3c.target.selector.push({type: "TextQuoteSelector", exact: annotation_object.target_exact[0].value});
    annotation_w3c.target.selector.push({
      type: "TextPositionSelector",
      start: annotation_object.target_start[0].value,
      end: annotation_object.target_end[0].value
    });
  }
  annotation_w3c.body = [];
  for (textualbody in annotation_object.textualbodies) {
    newtextualbody = {};
    newtextualbody.created = annotation_object.textualbodies[textualbody].created[0].value;
    newtextualbody.creator = {
      id: annotation_object.textualbodies[textualbody].creator_id[0].value,
      name: annotation_object.textualbodies[textualbody].creator_name[0].value
    }
    newtextualbody.modified = annotation_object.textualbodies[textualbody].modified[0].value;
    newtextualbody.purpose = annotation_object.textualbodies[textualbody].purpose[0].value;
    newtextualbody.type = "TextualBody";
    newtextualbody.value = annotation_object.textualbodies[textualbody].value[0].value;
    annotation_w3c.body.push(newtextualbody);
  }
  return annotation_w3c;
}
