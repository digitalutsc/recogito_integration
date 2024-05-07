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
##### Custom Annotations
- Custom annotations can be achieved by enabling `Enable custom annotation on HTML elements` in the configuration
- Enabling custom annotations will cause an input text box to appear
- Simply enter the associated HTML query selector for the DOM element. To learn the syntax structure you can reference [here](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Selectors)
- One element per line for the module to pickup each element
##### Annotations
- Annotations will be enabled when you configurate which content type could be annotatable and which fields
- Once these are set, go to the node you want to annotate that has the content type you configured and click the `Annotate` tab (its in the same area where `Edit` and `View` are)
- When a field is annotatable, you will be able to see a blue background behind the fields that are annotatable
- Image annotations behave the same as text annotations. Annotation on the image is allowed if the image itself is within the field that is configured to be annotatable
- Image annotations is simple box drawings on the region of the image you wish to have the annotation be displayed
##### Tag Inputs
Currently, this module only supports two forms of tag inputs (this could be decided in the config):
- Input via existing tag selection
  - This selection input supports selecting any tags that already exist within the selected vocabulary (does not support non-existent tag creation)
- Input via text
  - This text input supports tag creation (if enabled in settings) and basic tagging. Inputting any part of an existing tag will prompt an autocomplete for that specific tag.
Note: Tag creation will only occur if configured in the configuration form, otherwise, new tags added during the annotation process are discarded.


### Tag Profiling
- Go to the Vocabulary that is set in the config for tags
- Add a new field to the Vocabulary and set its field type to `Annotation Profile Color Field`
- Customize that field in each of the tags
  - You can enable whether a tag's styling should take affect or not
- Tag weights behave the same way that Drupal blocks are. The lower the weight the higher priority it is going to be used over other tags.

### Caveats
- If you modify the field that you have already annotated, the position of the annotations will not behave as expected. Text edits should be kept to a minimum to preserve positioning of annotations. To avoid this issue, ensure that annotations are created on content that is not actively updated.
- Permissions for anonymous users regarding `create annotation` will not work. Only authenticated users with the `create annotation` permission will be the lowest level of annotation creation allowed.
- Vocabulary that are used for tagging will be locked in and prohibited from being changed once an annotation has begun using the tags within that vocabulary. To remove this lock, simply remove any annotation that are using those tags. This is to preserve consistency.

### Note
- Permissions will need to be configured on installation of this module. By default only administrators are able to view, delete, create, and edit annotations. If you wish to let guests view annotations then you must configure that in the roles and permissions configuration.
