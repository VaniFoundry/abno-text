/**
 * ABNO-TEXT BUTTON IMPLEMENTATION GUIDE
 * =====================================
 * 
 * Based on the safety-tools module pattern, here's what you need to add/create
 * to make the loadout button work in the Foundry VTT scene controls.
 * 
 * OPTION 1: Using Hooks.on("getSceneControlButtons", ...)
 * ------------------------------------------------------------
 * Add this code to your module.js file:
 */

// The hook to add scene control buttons
Hooks.on("getSceneControlButtons", (controls) => {
  // Define your tool(s)
  const abnoTextTools = [
    {
      name: "abno-loadouts",      // Unique tool name
      title: "Abno-Text Loadouts", // Tooltip text
      icon: "fas fa-scroll",       // Font Awesome icon class
      toggle: true,                // Whether it's a toggle button
      visible: true,                // Visibility
      onChange: () => {            // Use onChange for toggle tools (NOT onClick!)
        console.log("Abno-Text: Loadouts toggled");
        toggleLoadoutsPanel();      // Your existing function
      }
    }
  ];

  // Create the control group
  const abnoTextController = {
    name: "abno-text",             // Unique group name
    title: "Abno-Text",            // Group title
    activeTool: "abno-loadouts",    // Default active tool
    visible: true,
    tools: abnoTextTools,          // Array of tools
    icon: "fas fa-comment-alt",    // Group icon
    layer: "abnoText"              // Canvas layer name
  };

  // Add to controls based on Foundry version
  if (foundry.utils.isNewerVersion(game.version, 13)) {
    // Foundry V13+: use object property
    controls["abno-text"] = abnoTextController;
  } else {
    // Older versions: push to array
    controls.push(abnoTextController);
  }
  
  console.log("Abno-Text: Control group added");
});


/**
 * OPTION 2: Using the Class-based approach (like safety-tools)
 * ------------------------------------------------------------
 * Create a class structure similar to safety-tools:
 */

class AbnoTextControls {
  constructor() {
    this.onInit = () => {
      // Initialization code
    };

    this.onSetup = () => {
      console.log("Abno-Text: Setting up controls");
    };

    this.onGetSceneControlButtons = (buttons) => {
      console.log("Abno-Text: Adding scene controls");
      
      const abnoTextTools = [
        {
          name: "abno-loadouts",
          title: "Abno-Text Loadouts",
          icon: "fas fa-scroll",
          toggle: true,
          visible: true,
          onChange: () => {
            toggleLoadoutsPanel();
          }
        }
      ];

      const controller = {
        name: "abno-text",
        title: "Abno-Text",
        activeTool: "abno-loadouts",
        visible: true,
        tools: abnoTextTools,
        icon: "fas fa-comment-alt",
        layer: "abnoText"
      };

      // Version-specific addition
      if (foundry.utils.isNewerVersion(game.version, 13)) {
        buttons["abno-text"] = controller;
      } else {
        buttons.push(controller);
      }
    };
  }
}

// Instantiate and register hooks
const abnoTextControls = new AbnoTextControls();

Hooks.once("init", () => {
  abnoTextControls.onInit();
});

Hooks.once("setup", () => {
  abnoTextControls.onSetup();
});

Hooks.on("getSceneControlButtons", (buttons) => {
  abnoTextControls.onGetSceneControlButtons(buttons);
});


/**
 * KEY POINTS TO REMEMBER:
 * -----------------------
 * 1. Use "onChange" instead of "onClick" for toggle buttons
 * 2. The tools array should contain objects with: name, title, icon, toggle, visible, onChange
 * 3. The controller object needs: name, title, activeTool, visible, tools, icon, layer
 * 4. For Foundry V13+: use controls["group-name"] = controller
 * 5. For older versions: use controls.push(controller)
 * 6. Make sure the function toggleLoadoutsPanel() is defined and accessible
 */
