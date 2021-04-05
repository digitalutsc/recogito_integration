Image annotation branch.

To load on a page, requires an openseadragon viewer to be present. Additionally, requires a drupalSettings variable 'islandora_open_seadragon_viewer' set to the viewer used for openseadragon.

For example, in the JS file used to create the OpenSeadragon viewer:
`var viewer = new OpenSeadragon.Viewer(options);`
`drupalSettings.islandora_open_seadragon_viewer = viewer`

Current issue: Upon refresh, OpenSeadragon Annotorious library seems to break when attempting to create/view an annotation. Annotations can only be viewed, modified, created, and deleted on hard refresh of the page, which is not ideal for users. Nat suggested this is due to a load order issue.

Current load order is like so:

function awaitOpenSeadragon() in the js/openseadragon-annotorious.min.js file waits for an openseadragon viewer to be present. Then js/injector.js waits for both the openseadragon viewer and the annotorious library.