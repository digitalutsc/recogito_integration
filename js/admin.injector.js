let image_annotations = [];
const MAX_TAG_LENGTH = '150';
let annotatedObjects = {};

/**
 * Converts a hexadecimal color code into the corresponding RGBA string. 
 * Credit:  https://stackoverflow.com/a/21648508
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

jQuery(document).ready(function () { 
  let perms = drupalSettings.recogito_integration.permissions;
  let isAdmin = drupalSettings.recogito_integration.admin;
  if (!isAdmin) {
    return;
  }
  if (perms['view']) {
    initializeView(drupalSettings.recogito_integration);
  }
});

function initializeView(settings) {
  let perms = settings.permissions;
  if (jQuery('.openseadragon-canvas').length > 0) {
    setTimeout(awaitOpenSeadragonAnnotations, 300, perms);
  }
  initTextAnnotations(settings);
}

function initAnnotations(settings) {
  let tagLists = settings.tagLists;
  let customDOM = settings.custom_elements;
  let userData = settings.userData;
  let defaultTag = settings.defaultTag;
  let annotatables = settings.annotatable_fields;
  for (let ids in annotatables) {
    attachDOMField(ids, false);
  }

}

function attachDOMField(attachDOM, custom) {
  
}
