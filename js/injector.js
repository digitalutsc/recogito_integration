jQuery(document).ready(function () {
  var can_read_annotations = false;
  var perms = drupalSettings.recogito_integration.permissions;
  if (perms['recogito view annotations'] && !window.location.pathname.includes('recogito_integration')) {
    setTimeout(highlightActive, 30);
    if(jQuery('.openseadragon-canvas').length > 0){ //check for OpenSeadragon
      setTimeout(awaitOpenSeadragonAnnotorious, 300, perms);
    }
   // var articles = jQuery('article');
    var articles = jQuery("article").find('.node__content');
    if (!articles.length){ //this should never happen
      initTextAnnotation(perms);
      setTimeout(function (){
        //initialize annotations for all simple images on the page
        var imgElements = jQuery("main").find("img");
        var i;
        for (i = 0; i<imgElements.length;i++){
          initSimpleImageAnnotation(imgElements[i], perms);
        }
      }, 150)
    }
    else{
      for(var j = 0; j < articles.length; j++){
        var temp_num = articles[j].innerHTML.split('node/')[1].split('/')[0]; //get the node to which the current content belongs
        //if (articles[j].getAttribute('data-history-node-id')
          if (temp_num !== null){
            initTextAnnotation(perms, temp_num, articles[j]);
            var imgs = articles[j].getElementsByTagName('img');
            for (var p = 0; p < imgs.length; p++) {
              initSimpleImageAnnotation(imgs[p], perms, temp_num);//articles[j].getAttribute('data-history-node-id'));
            }
        }
      }

    }
  //  initTextAnnotation(perms);
  }
});

/**
 * Ensures the active mode is visually selected
 */
function highlightActive(){
  if (window.location.search.includes('?mode=annotation') &&
      jQuery("ul.primary > li")[2].firstElementChild.className !== 'is-active'){
    jQuery("ul.primary > li")[2].firstElementChild.className += 'is-active';
  }
  else if (!window.location.search.includes('?mode=annotation') &&
      jQuery("ul.primary > li")[0].firstElementChild.className !== 'is-active'){
    jQuery("ul.primary > li")[0].firstElementChild.className += 'is-active';
  }
}
/**
 * Setup annotations for simple images (those not in an OpenSeadragon viewer)
 * @param image : Object HTMLImageElement
 * @param perms : assigned permission config
 * @param node_num : int the node to which the image belongs
 */
function initSimpleImageAnnotation(image, perms, node_num){
  var user_data = drupalSettings.recogito_integration.user_data;
  var customAttributeName = drupalSettings.recogito_integration.attach_attribute_name;
  var range = drupalSettings.recogito_integration.annotation_range;
  var strings = drupalSettings.recogito_integration.taxonomy_terms;
  var default_term = drupalSettings.recogito_integration.default_term;
  var readOnly1 = (!perms['recogito create annotations'] &&
      !perms['recogito edit annotations'] &&
      !perms['recogito delete annotations'] &&
      !perms['recogito edit own annotations'] &&
      !perms['recogito delete own annotations'])
 // var imgElement = document.querySelector('img[loading="lazy"]');
  var imgElement = image;
  var anno = Annotorious.init({
    image: imgElement,
  //  readOnly: readOnly1 || window.location.search !== "?mode=annotation"
    readOnly: readOnly1 || !window.location.search.includes('?mode=annotation'),
    widgets: [
      'COMMENT',
      {widget: 'TAG', vocabulary: strings}
    ],
    relationVocabulary: ['isRelated', 'isPartOf', 'isSameAs ']
  });
 // var anno = Annotorious.init({image: imgElement});
  anno.setAuthInfo({'id': user_data.id, 'displayName': user_data.displayName});


  // window.location.hostname + "/modules/recogito_integration/recogito_integration_functions.php"
  var page_url = window.location.pathname;
  var curr_node = window.location.pathname.split('/')[2] == node_num;
  if (!curr_node) page_url = '/node/' + node_num;

  jQuery.ajax({
    type: "GET",
    url: "/recogito_integration/get",
    dataType: 'json',
    headers: {
      'pageurl': page_url//'/node/' + node_num
    },

    success: function (data) {
      console.log(data);
      for (annotation in data) {

        w3c = convert_annotation_w3c(data[annotation]);
        if (w3c.type !== "Annotation" && imgElement["src"] == w3c["target"]["source"]) {
          anno.addAnnotation(w3c);
        }
      }
    },
    error: function (xhr, status, error) {
      alert(xhr.responseText);
    }
  });



  anno.on('selectAnnotation', function (annotation) {
    if (!anno.ready) setTimeout(addAccessibilityLabel, 10);
    highlightAnnotatedContent(annotation);
  });

  anno.on('createAnnotation', function (annotation) {
    if (!curr_node)
      create_annotation(annotation, node_num);
    else
      create_annotation(annotation);
  });

  anno.on('updateAnnotation', function (annotation, previous) {

    console.log(annotation);
    console.log(previous);
    update_annotation(annotation, previous);
  });

  anno.on('deleteAnnotation', function (annotation) {
    delete_annotation(annotation);
  });
}

/**
 * Setup up an OpenSeadragon viewer based on the one already on the page
 * @param perms : assigned permission config
 */
function awaitOpenSeadragonAnnotorious(perms)
{
  var ids = [];
  //get the ids for all OSD viewers on screen
  jQuery(".openseadragon-viewer").each(function (){
    if (this.getElementsByClassName('openseadragon-container').length) ids.push(this.getAttribute('id'));
    else this.remove(); //remove empty viewers
  })

  //remove old viewer
  jQuery('.openseadragon-canvas').remove();  //was hide
  jQuery('.openseadragon-container').remove();  //was hide

  //get the options for the old viewers
  var temps = [];
  var node_nums = [];
  ids.forEach(function (element){
    temps.push(drupalSettings['openseadragon'][element]['options']);
    var temp = document.getElementById(element);
    while (temp.getAttribute('data-quickedit-field-id') == null){
      temp = temp.parentElement;
    }
    node_nums.push(temp.getAttribute('data-quickedit-field-id').split('node/')[1].split('/')[0]);
  })

  var viewers = [];
  temps.forEach(element => viewers.push(OpenSeadragon({
    id: element['id'],
    prefixUrl: element['prefixUrl'],
    tileSources: element['tileSources'],
    sequenceMode: element['tileSources'].length > 1 //if there are multiple images in the viewer, show them in sequence
  })));

  if (typeof OpenSeadragon != "undefined" && typeof OpenSeadragon.Annotorious != "undefined"
    && typeof viewers !== "undefined") {
    viewers.forEach((element, index) => initOpenSeadragonAnnnotation(element, perms, node_nums[index]));
  }
}
/**
 * Setup annotation for text
 * @param perms : assigned permission config
 */
function initTextAnnotation(perms) {
  var user_data = drupalSettings.recogito_integration.user_data;
  var customAttributeName = drupalSettings.recogito_integration.attach_attribute_name;
  var range = drupalSettings.recogito_integration.annotation_range;
  var strings = drupalSettings.recogito_integration.taxonomy_terms;
  var default_term = drupalSettings.recogito_integration.default_term;
  var readOnly = (!perms['recogito create annotations'] &&
      !perms['recogito edit annotations'] &&
      !perms['recogito delete annotations'] &&
      !perms['recogito edit own annotations'] &&
      !perms['recogito delete own annotations'])

  // hide popup if readonly mode is currently set for current anonymous user
  //if (readOnly || window.location.search !== "?mode=annotation") {
    if (readOnly || !window.location.search.includes('?mode=annotation')) {
      jQuery("article > div.node__content > div.field--name-body").click(function (e) {
        jQuery('.r6o-editor').hide();
        if (e.target.tagName.toLowerCase() === 'span' && (jQuery(e.target).attr('class') === "r6o-annotation")) {
          jQuery('.r6o-editor').show();
        }
      });
    }
 // }

  // visually set Annotation tab item enabled
  jQuery("ul.primary > li").each(function( index ) {
    jQuery(this).removeClass('is-active');
  });

  // Kyle added: special usecase : if Custom DOM mode is on, look and highlight and enable annotation for that DOM only
  var attach_element = [-1];
  if (range === "limited" && customAttributeName.length > 0) {
    attach_element = [];
    for (var j = 0; j < customAttributeName.length; j++) {
      var element = jQuery(customAttributeName[j]);
      if (customAttributeName[j].startsWith("#")) {
        if (window.location.search == "?mode=annotation") {
          element.css('background-color', '#dfeaff');
        }
        attach_element.push(element[0]);
      }
      else {
        for (var k = 0; k < element.length; k++) {
          if (window.location.search == "?mode=annotation") {
            element[k].css('background-color', '#dfeaff');
          }
          attach_element.push(element[k]);
        }
      }
    }
  }
  else {
    // change background for annotated area:
    //if (window.location.search == "?mode=annotation") {
    if (window.location.search.includes("?mode=annotation")){
      jQuery("article > div.node__content").css('background-color', '#dfeaff');
    }
    var attach_element = jQuery("article > div.node__content");

  }

  // check  annotation are allow to be enable for DOM or content type. If not, display warning
  if (attach_element[0] !== -1 ) {

    // need [0] because selector returns an array instead of object
    if (arguments.length !== 3){
      for (var i = 0; i < attach_element.length; i++) {
        var text_anno = Recogito.init({
          content: attach_element[i], // Element id or DOM node to attach to
          allowEmpty: true,
          locale: 'auto',
          readonly: readOnly,
          widgets: [
            'COMMENT',
            {widget: 'TAG', vocabulary: strings}
          ],
          relationVocabulary: ['isRelated', 'isPartOf', 'isSameAs ']
          // readOnly: readOnly || window.location.search !== "?mode=annotation" //John added this
        });
        text_anno.setAuthInfo({'id': user_data.id, 'displayName': user_data.displayName});

        getAnnotations(text_anno);
        if (default_term != -1) { // ignore when no default tag is selected
          jQuery( ".node__content" ).bind('DOMSubtreeModified', function (e) {
            if (e.target.tagName === "SPAN" && e.target.hasAttribute("data-id") === false) {
              setTimeout(setDefaultTerm, 10);
              //setTimeout(addAccessibilityLabel, 10);
              return;
            }
          });
        }

        text_anno.on('selectAnnotation', function (annotation) {
          // TODO: check if there is preset configuration ready before intial Recogito JS annotation
          if (drupalSettings.recogito_integration.initial_setup){
            highlightAnnotatedContent(annotation);
            if (text_anno.readOnly == undefined || !text_anno.readOnly) setTimeout(addAccessibilityLabel, 15);
          }
          else{
            alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
          }
        });
        text_anno.on('createAnnotation', function (annotation) {
          if (default_term != -1) { // ignore when no default tag is selected
            // set "footnote" as default vocabulary
            var tmp = annotation.body[0];
            annotation.body.push({
              created: tmp.created,
              creator: tmp.creator,
              modified: tmp.modified,
              purpose: "tagging",
              type: tmp.type,
              value: default_term,
            });
          }
          // TODO: check if there is preset configuration ready before intial Recogito JS annotation
          if (drupalSettings.recogito_integration.initial_setup === false)
            alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
          else if (perms['recogito create annotations'] === false)
            alert("Your annotation won't be saved because you don't have permission to create annotation for this content.")
          else
            create_annotation(annotation);
        });

        text_anno.on('updateAnnotation', function (annotation, previous) {
          // TODO: check if there is preset configuration ready before intial Recogito JS annotation
          if (drupalSettings.recogito_integration.initial_setup === false)
            alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
          else if (perms['recogito edit annotations'] === false)
            alert("Your annotation won't be saved because you don't have permission to update this annotation of this content.")
          else
            update_annotation(annotation, previous);
        });

        text_anno.on('deleteAnnotation', function (annotation) {
          // TODO: check if there is preset configuration ready before intial Recogito JS annotation

          if (drupalSettings.recogito_integration.initial_setup === false)
            alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
          else if (perms['recogito delete annotations'] === false)
            alert("Your annotation won't be saved because you don't have permission to update this annotation of this content.")
          else
            delete_annotation(annotation);
        });
      }
    }
    else{
      var working_node = arguments[1];
      var text_anno = Recogito.init({
        content: arguments[2], // Element id or DOM node to attach to
        allowEmpty: false,  //changed to false by John
        locale: 'auto',
        readonly: readOnly,
        widgets: [
          'COMMENT',
          {widget: 'TAG', vocabulary: strings}
        ],
        relationVocabulary: ['isRelated', 'isPartOf', 'isSameAs ']
        // readOnly: readOnly || window.location.search !== "?mode=annotation" //John added this
      });
      text_anno.setAuthInfo({'id': user_data.id, 'displayName': user_data.displayName});
      getAnnotations(text_anno, arguments[1]);
      if (default_term != -1) { // ignore when no default tag is selected
        jQuery( ".node__content" ).bind('DOMSubtreeModified', function (e) {
          if (e.target.tagName === "SPAN" && e.target.hasAttribute("data-id") === false) {
            setTimeout(setDefaultTerm, 10);
            //setTimeout(addAccessibilityLabel, 10);
            return;
          }
        });
      }
      text_anno.on('selectAnnotation', function (annotation) {
        // TODO: check if there is preset configuration ready before intial Recogito JS annotation
        if (drupalSettings.recogito_integration.initial_setup){
          highlightAnnotatedContent(annotation);
          if (text_anno.readOnly == undefined || !text_anno.readOnly) setTimeout(addAccessibilityLabel, 15);
        }
        else{
          alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
        }
      });

      text_anno.on('createAnnotation', function (annotation) {
        if (default_term != -1) { // ignore when no default tag is selected
          // set "footnote" as default vocabulary
          var tmp = annotation.body[0];
          annotation.body.push({
            created: tmp.created,
            creator: tmp.creator,
            modified: tmp.modified,
            purpose: "tagging",
            type: tmp.type,
            value: default_term,
          });
        }
        // TODO: check if there is preset configuration ready before intial Recogito JS annotation
        if (drupalSettings.recogito_integration.initial_setup === false)
          alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
        else if (perms['recogito create annotations'] === false)
          alert("Your annotation won't be saved because you don't have permission to create annotation for this content.")
        else{
          create_annotation(annotation, working_node);
        }

      });
      text_anno.on('updateAnnotation', function (annotation, previous) {
        // TODO: check if there is preset configuration ready before intial Recogito JS annotation
        if (drupalSettings.recogito_integration.initial_setup === false)
          alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
        else if (perms['recogito edit annotations'] === false)
          alert("Your annotation won't be saved because you don't have permission to update this annotation of this content.")
        else
          update_annotation(annotation, previous);
      });
      text_anno.on('deleteAnnotation', function (annotation) {
        // TODO: check if there is preset configuration ready before intial Recogito JS annotation

        if (drupalSettings.recogito_integration.initial_setup === false)
          alert("Your annotation won't be saved because Recogito Annotation has not been setup yet. \n\nPlease setup the configuration at "+window.location.protocol+ "//" +window.location.hostname+"/admin/config/development/recogito_integration");
        else if (perms['recogito delete annotations'] === false)
          alert("Your annotation won't be saved because you don't have permission to update this annotation of this content.")
        else
          delete_annotation(annotation);
      });
    }
  }
  else {
    if (window.location.search == "?mode=annotation") {
      jQuery("article > div.node__content").html('<p><strong>Sorry, the annotation functionality for this content is not available because this content type is not set for annotation OR no preset class or ID can be found in this page\'s body.</strong> </p>' +
          '<p>Please visit <a href="/admin/config/development/recogito_integration"> the configuration</a> for adjustment.</p>');
    }
  }

}

function setDefaultTerm() {
  var term = drupalSettings.recogito_integration.default_term;
  var div = jQuery(".r6o-tag").find('div')[0];
  jQuery(div).html(
      '<ul class="r6o-taglist">' +
      '<li>' +
      '<span class="r6o-label">'+term+ '</span>' +
      '</li>' +
      '</ul>'
  );
}

/**
 * Adds the required ARIA attributes for annotation editor
 */
function addAccessibilityLabel()
{

  //jQuery(".r6o-editable-text").attr("aria-label", "test label");
  var elems = jQuery(".r6o-editable-text");
  for (var i = 0; i < elems.length-1; i++)
  {
    //add aria-label to comments
    elems[i].setAttribute("aria-label", "Comment " + (i+1));
  }
  //add aria-label to reply field
  if(typeof elems[elems.length - 1] !== 'undefined') elems[elems.length - 1].setAttribute("aria-label", "Add a reply");
  //make "aria-labelledby" match the id and add a title
  var loc = jQuery(".r6o-autocomplete").find("input")[0];
  var id = jQuery(loc).attr("id");
  jQuery(loc).attr("aria-labelledby", id);
  jQuery(loc).attr("title", "Add a tag");

  loc = jQuery(".r6o-autocomplete").find("ul")[0];
  id = jQuery(loc).attr("id");
  jQuery(loc).attr("aria-labelledby", id);
}


/**
 * Ajax call to get list of annotation base on node url
 *
 * @param recogito
 * @param node_num : int the node to get the annotations for
 */
function getAnnotations(recogito, node_num, readonly = false) {

  var page_url = window.location.pathname;
  if (typeof node_num !== "boolean" && node_num !== window.location.pathname.split('/')[2]) page_url = '/node/' + node_num;//make sure a node_num is being used
  jQuery.ajax({
    type: "GET",
    url: "/recogito_integration/get",
    dataType: 'json',
    headers: {
      'pageurl': page_url
    },

    success: function (data) {
      for (annotation in data) {
        w3c = convert_annotation_w3c(data[annotation]);
        recogito.addAnnotation(w3c, readonly);
      }
    },
    error: function (xhr, status, error) {
      console.log(xhr.responseText);
    }
  });
}

/**
 * Setup annotation for Openseadragon viewer
 *
 * @param viewer : Object viewer object
 * @param perms : assigned permission config
 * @param node_num : int the node to which the OSD viewer belongs
 */
function initOpenSeadragonAnnnotation(viewer, perms, node_num) {
  //////////////////////////////////////////////////////////////////////////////
  var strings = drupalSettings.recogito_integration.taxonomy_terms;
  var user_data = drupalSettings.recogito_integration.user_data;
  var readOnly1 = (!perms['recogito create annotations'] &&
      !perms['recogito edit annotations'] &&
      !perms['recogito delete annotations'] &&
      !perms['recogito edit own annotations'] &&
      !perms['recogito delete own annotations']);

  var image_anno = OpenSeadragon.Annotorious(viewer, {
        readOnly: readOnly1 || !window.location.search.includes("?mode=annotation"),
        widgets: [
          'COMMENT',
          {widget: 'TAG', vocabulary: strings}
        ],
        relationVocabulary: ['isRelated', 'isPartOf', 'isSameAs ']

      });
  image_anno.setAuthInfo({'id': user_data.id, 'displayName': user_data.displayName});

  //for multi page support
  viewer.addHandler('page', function (){

    //get rid of any annotations that may be open on the current page
    setTimeout(function (){
      jQuery('.r6o-editor').remove();

    }, 20);

    //remove all annotation on the viewer
    image_anno.clearAnnotations();

    //add annotations that belong to this page
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
          w3c = convert_annotation_w3c(data[annotation]);
          //make sure this annotation belongs here
          if(w3c.type !== "Annotation" && viewer["tileSources"][viewer.currentPage()] == w3c["target"]["source"])
          {
            image_anno.addAnnotation(w3c);
          }
        }
      },
      error: function (xhr, status, error) {
        alert(xhr.responseText);
      }
    });
  });

 // window.location.hostname + "/modules/recogito_integration/recogito_integration_functions.php"

  //var page_url = window.location.pathname;

  var page_url = '/node/' + node_num;

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
        w3c = convert_annotation_w3c(data[annotation]);
        //make sure this annotation belongs here
        if(w3c.type !== "Annotation" && viewer["tileSources"][0] == w3c["target"]["source"])
        {
          image_anno.addAnnotation(w3c);
        }
      }
    },
    error: function (xhr, status, error) {
      alert(xhr.responseText);
    }
  });


  image_anno.on('selectAnnotation', function (annotation) {
    if (!image_anno.readOnly) setTimeout(addAccessibilityLabel, 15);
    highlightAnnotatedContent(annotation);
    if (image_anno.readOnly){
      setTimeout(function (){
        if (!jQuery(".r6o-label").length){
          jQuery(".r6o-widget.r6o-tag").hide();
        }
      }, 25);

    }

  });

  image_anno.on('createAnnotation', function (annotation) {
    create_annotation(annotation, node_num, viewer.currentPage());
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

/**
 * When selecting an annotation, remove buttons the user has insufficient
 * permissions for
 *
 * @param a: annotation object
 */
function highlightAnnotatedContent(a) {
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
  jQuery(".r6o-editor").show();
  var startTimeInMs = Date.now();

  //Show and hide specific features depending on permissions
  (function loopSearch() {
    if (jQuery('.r6o-widget').length == comment_count + 2) { //Work once all comments have been loaded

      // Kyle added to have Admin user 's view (eg. /node/1) page has readonly mode only
      var readOnly = false;
      console.log(drupalSettings.recogito_integration.admin_view_mode);
      if (drupalSettings.recogito_integration.admin_view_mode === true && window.location.search !== "?mode=annotation") {
        readOnly = true;
      }
      else {
        readOnly = (!perms['recogito create annotations'] && !perms['recogito edit annotations'] && !perms['recogito delete annotations'] && !perms['recogito edit own annotations'] && !perms['recogito delete own annotations']);
      }
      if (readOnly) {
        jQuery('.r6o-arrow-down').hide();
       // jQuery('.a9s-annotation.editable.selected').attr("class", ".r6o-editor");
      }
    /*  if (window.location.search !== "?mode=annotation"){

        jQuery(".r6o-widget.r6o-tag").hide();
      }*/

      // loop through replies to enfource Readonly mode or not
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
      // jQuery('.delete-annotation').hide();
      return;
    } else {
      setTimeout(function () {
        loopSearch();
      }, 50);
    }
  })();
}

/**
 * Create an annotation within Drupal, given W3C data
 *
 * @param a
 * @param node_num : int the on which the annotation is created
 */
function create_annotation(a, /*, node_num*/) {
  var page_url;
  var annotation_obj = convert_annotation_object(a);

  arguments.length >= 2 ? page_url = '/node/' + arguments[1] : page_url = window.location.pathname;

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
      alert("Sorry, unable to create the annotation because of error: \n\n" + error);
    }
  });


}

/**
 * Update an annotation in Drupal, given W3C data
 *
 * @param annotation
 * @param previous
 */
function update_annotation(annotation, previous) {
  var annotation_obj = convert_annotation_object(annotation);
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
      alert("Sorry, unable to update the annotation because of error: \n\n" + error);
    }
  });
}

/**
 * Delete an annotation from Drupal, given W3C data
 *
 * @param annotation
 */
function delete_annotation(annotation) {
  var annotation_obj = convert_annotation_object(annotation);
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
      //xhr.responseText
      alert("Sorry, unable to delete the annotation because of error: \n\n" + error);
    }
  });
}


/**
 * Convert a W3C annotation object to an object containing the bare minimum of
 * data to store
 *
 * @param a : annotation object
 * @returns {{}}
 */
function convert_annotation_object(a) {
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

/**
 * Convert an object with only stored data to a W3C object to pass to the
 * library
 *
 * @param annotation_object
 * @returns {{}}
 */
function convert_annotation_w3c(annotation_object) {
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
