var AnnotationConverter = (function() {
  /**
   * Convert a W3C annotation to a data compatible with database.
   *
   * @param {object} annotation
   * @returns {object}
   */
  function convertW3CToData(annotation) {
    let data = {};
    data['id'] = annotation.id;
    data['textualbodies'] = annotation.body;
    for (let body of data['textualbodies']) {
      body['value'] = encodeURIComponent(body['value']);
    }
    switch (annotation.type) {
      case 'Text':
        for (let selector of annotation.target.selector) {
          switch (selector.type) {
            case 'TextQuoteSelector':
              data['target_exact'] = encodeURIComponent(selector.exact);
              break;

            case 'TextPositionSelector':
              data['target_start'] = selector.start;
              data['target_end'] = selector.end;
              break;
          }
        }
        break;

      case 'Image':
        data['image_value'] = annotation.target.selector.value;
        data['image_source'] = annotation.target.source;
        break;
    }
    data['type'] = annotation.type;
    data['target_element'] = annotation.target_element;
    return data;
  }

  /**
   * Converts data from database into W3C annotation.
   *
   * @param {object} data
   * @returns {object}
   */
  function convertDataToW3C(data) {
    let annotation = {};
    annotation['@context'] = 'http://www.w3.org/ns/anno.jsonld';
    annotation['id'] = data['id'];
    annotation['type'] = data['type'];
    annotation['target'] = {selector: []};
    switch (annotation['type']) {
      case 'Text':
        if (data['target_exact'] > 0) {
          annotation['target'].selector.push({
            type: 'TextQuoteSelector',
            exact: decodeURIComponent(data['target_exact'])
          });
        }
        annotation['target'].selector.push({
          type: 'TextPositionSelector',
          start: data['target_start'],
          end: data['target_end']
        });
        annotation['style'] = data['style'];
        break;

      case 'Image':
        annotation['target'].selector = {
          conformsTo: "http://www.w3.org/TR/media-frags/",
          type: 'FragmentSelector',
          value: data['image_value']
        };
        annotation['target'].source = data['image_source'];
        break;
    }
    annotation['body'] = [];
    for (let body of data['textualbodies']) {
      content = {};
      content['created'] = body['created'];
      content['creator'] = body['creator'];
      content['modified'] = body['modified'];
      content['purpose'] = body['purpose'];
      content['type'] = 'TextualBody';
      content['value'] = decodeURIComponent(body['value']);
      annotation['body'].push(content);
    }
    annotation['target_element'] = data['target_element'];
    return annotation;
  }
  return {
    convertW3CToData: convertW3CToData,
    convertDataToW3C: convertDataToW3C
  };
})();