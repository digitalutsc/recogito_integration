# Recogito Integration Module

### Features
 - Annotate text and images in Nodes
 - Integration with Drupal roles and permissions (Creating, Reading, Updating, & Deleting Permissions)
 - Annotations are taggable using Taxonomy
 - Control appearances using tag profiles and/or using settings
 - Tag autocomplete for annotations
 - Annotate selected fields only (the annotation also carry over to views that extract information from the field)
 - Annotate non-field elements on the page by adding its HTML attributes

### Configuration
The config is located in `/admin/config/development/recogito_integration`. To allow any form of annotation, please scroll down and select a vocabulary (preferably a new vocabulary) to allow the module to function. The configuration is straightforward, if you like to have a content type to be annotatable, simply check the checkbox for that type and pick the fields to be annotatable.

### Tag Profiling
- Go to the Vocabulary that is set in the config for tags
- Add a new field to the Vocabulary and set its field type to 'Annotation Profile Color Field'
- Customize that field in each of the tags
  - You can enable whether a tag's styling should take affect or not.

### Caveats
If you modify the field that you have already annotated, the position of the annotations will not behave as expected. Text edits should be kept to a minimum to preserve positioning of annotations. To avoid this issue, ensure that annotations are created on content that is not actively updated.