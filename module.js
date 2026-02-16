console.log("ABNO TEXT MODULE LOADED");

let intervalId = null;
let sequenceIndex = 0;
let activeRects = [];

/* ---------------------------- */
/* SETTINGS                     */
/* ---------------------------- */
Hooks.once("init", () => {
  game.settings.register("abno-text", "config", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      messages: ["Default text...", "Default second line of text.", "Third line of default text."],
      duration: 4000,
      fadeOutTime: 600,
      frequency: 0,
      fontSize: 64,
      color: "#ff3333",
      fontFamily: "serif",
      typingSpeed: 40,
      randomMode: false,
      randomAngle: true,
      maxAngle: 25,
      autoScaleLongText: true,
      maxSimultaneous: 3,
      outlineEnabled: true,
      outlineColor: "#000000",
      outlineThickness: 3
    }
  });

  game.settings.register("abno-text", "enabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register("abno-text", "loadouts", {
    scope: "world",
    config: false,
    type: Object,
    default: { custom: {} }
  });

  game.settings.register("abno-text", "activeLoadout", {
    scope: "world",
    config: false,
    type: String,
    default: "default"
  });

  game.settings.registerMenu("abno-text", "configMenu", {
    name: "Abno-Text Configuration",
    label: "Open Configuration",
    type: AbnoTextConfig,
    restricted: true
  });
  
  // Registrar helper de Handlebars para comparación
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // ----------------------------
  // SOCKET COMMUNICATION SETUP
  // ----------------------------
  // Register socket handler to receive broadcasted messages from GM
  game.socket.on("module.abno-text", (data) => {
    //console.log("ABNO: Received broadcast message:", data.message);
    if (data.message) {
      showAbnoMessage(data.message);
    }
  });
  
  console.log("ABNO: Socket communication setup complete");
});


/* ---------------------------- */
/* READY                        */
/* ---------------------------- */
Hooks.once("ready", () => {
  // Only start auto-messages if user is GM
  if (game.user.isGM && game.settings.get("abno-text", "enabled")) {
    startAutoMessages();
    console.log("ABNO: Module ready, GM mode enabled =", game.settings.get("abno-text", "enabled"));
  } else if (!game.user.isGM) {
    console.log("ABNO: Module ready, non-GM user - auto-messages disabled");
  } else {
    console.log("ABNO: Module ready, enabled =", game.settings.get("abno-text", "enabled"));
  }
});


/* ---------------------------- */
/* SCENE CONTROLS (V13 FIXED)   */
/* ---------------------------- */
Hooks.on("getSceneControlButtons", (controls) => {
  console.log("ABNO: getSceneControlButtons hook fired");
  
  if (!game.user.isGM) {
    console.log("ABNO: User is not GM, skipping");
    return;
  }

  // Crear nuestro propio grupo de controles
  controls.abnoText = {
    name: "abnoText",
    title: "Abno Text",
    icon: "fas fa-comment",
    visible: true,
    layer: "controls",
    activeTool: "select",
    tools: {
      // Tool de selección (requerido)
      select: {
        name: "select",
        title: "Abno Text Controls",
        icon: "fas fa-comment"
      },
      // Toggle Enable/Disable - CORREGIDO
      toggle: {
        name: "toggle",
        title: game.settings.get("abno-text", "enabled") ? "Disable Abno-Text" : "Enable Abno-Text",
        icon: "fas fa-power-off",
        toggle: true,
        active: game.settings.get("abno-text", "enabled"),
        onClick: async () => {
          // Invertir el estado actual
          const currentState = game.settings.get("abno-text", "enabled");
          const newState = !currentState;
          
          console.log("ABNO: Toggle clicked, changing from", currentState, "to", newState);
          
          await game.settings.set("abno-text", "enabled", newState);
          
          if (!newState && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            console.log("ABNO: Auto messages stopped");
          }
          if (newState) {
            startAutoMessages();
            console.log("ABNO: Auto messages started");
          }
          
          // Actualizar la UI
          ui.controls.render();
          ui.notifications.info(`Abno-Text ${newState ? "Enabled" : "Disabled"}`);
        }
      },
      // Loadouts menu
      loadouts: {
        name: "loadouts",
        title: "Open Abno-Text Loadouts",
        icon: "fas fa-scroll",
        button: true,
        onClick: () => {
          console.log("ABNO: Loadouts button clicked");
          new AbnoLoadoutMenu().render(true);
        }
      },
      // Config menu
      config: {
        name: "config",
        title: "Open Abno-Text Configuration",
        icon: "fas fa-cog",
        button: true,
        onClick: () => {
          console.log("ABNO: Config button clicked");
          new AbnoTextConfig().render(true);
        }
      }
    }
  };
  
  console.log("ABNO: Control group added successfully");
});


/* ---------------------------- */
/* MESSAGE FUNCTIONS             */
/* ---------------------------- */
function getNextMessage() {
  const config = game.settings.get("abno-text", "config");
  if (!config.messages.length) return null;
  if (config.randomMode) return config.messages[Math.floor(Math.random() * config.messages.length)];
  const msg = config.messages[sequenceIndex];
  sequenceIndex = (sequenceIndex + 1) % config.messages.length;
  return msg;
}

function showAbnoMessage(text) {
  if (!game.settings.get("abno-text", "enabled")) return;

  const config = game.settings.get("abno-text", "config");
  if (activeRects.length >= config.maxSimultaneous) return;

  const overlay = $(`<div class="abno-overlay"></div>`);
  const textElement = $(`<div class="abno-text"></div>`);
  overlay.append(textElement);
  document.body.appendChild(overlay[0]);
  overlay.css({ opacity: 0 });

  textElement.css({
    position: "absolute",
    fontSize: config.fontSize + "px",
    color: config.color,
    fontFamily: config.fontFamily,
    maxWidth: "90vw",
    whiteSpace: "normal",
    textAlign: "center",
    textShadow: config.outlineEnabled ? generateOutline(config) : "none"
  });

  textElement.text(text);
  if (config.autoScaleLongText) autoScaleText(textElement[0]);

  const rotationDeg = config.randomAngle ? (Math.random() * config.maxAngle * 2) - config.maxAngle : 0;
  const placedRect = placeWithoutOverlap(textElement, rotationDeg);
  if (!placedRect) return overlay.remove();

  activeRects.push(placedRect);
  textElement.css("transform", `rotate(${rotationDeg}deg)`);
  overlay.animate({ opacity: 1 }, 150);

  textElement.text("");
  let i = 0;
  const typingInterval = setInterval(() => {
    textElement.text(text.slice(0, i));
    i++;
    if (i > text.length) {
      clearInterval(typingInterval);
      startLifetimeTimer(overlay, placedRect, config);
    }
  }, config.typingSpeed);
}


/* ---------------------------- */
/* PLACEMENT + LIFETIME          */
/* ---------------------------- */
function placeWithoutOverlap(element, rotationDeg = 0) {
  element[0].offsetWidth;
  const rect = element[0].getBoundingClientRect();
  const angle = rotationDeg * Math.PI / 180;
  const rotatedWidth = Math.abs(rect.width * Math.cos(angle)) + Math.abs(rect.height * Math.sin(angle));
  const rotatedHeight = Math.abs(rect.width * Math.sin(angle)) + Math.abs(rect.height * Math.cos(angle));
  const maxX = window.innerWidth - rotatedWidth;
  const maxY = window.innerHeight - rotatedHeight;
  if (maxX <= 0 || maxY <= 0) return null;

  let tries = 0;
  while (tries < 50) {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    element.css({ left: x + "px", top: y + "px", transform: `rotate(${rotationDeg}deg)` });
    const newRect = element[0].getBoundingClientRect();
    const overlaps = activeRects.some(r => !(newRect.right < r.left || newRect.left > r.right || newRect.bottom < r.top || newRect.top > r.bottom));
    if (!overlaps) return newRect;
    tries++;
  }
  return null;
}

function startLifetimeTimer(overlay, rect, config) {
  setTimeout(() => {
    overlay.fadeOut(config.fadeOutTime, () => {
      activeRects = activeRects.filter(r => !(r.left === rect.left && r.top === rect.top && r.right === rect.right && r.bottom === rect.bottom));
      overlay.remove();
    });
  }, config.duration);
}

function generateOutline(config) {
  const shadows = [];
  for (let x = -config.outlineThickness; x <= config.outlineThickness; x++) {
    for (let y = -config.outlineThickness; y <= config.outlineThickness; y++) {
      if (x !== 0 || y !== 0) shadows.push(`${x}px ${y}px 0 ${config.outlineColor}`);
    }
  }
  return shadows.join(",");
}

function autoScaleText(element) {
  let size = parseInt(window.getComputedStyle(element).fontSize);
  while ((element.scrollWidth > window.innerWidth * 0.95 || element.scrollHeight > window.innerHeight * 0.95) && size > 12) {
    size -= 2;
    element.style.fontSize = size + "px";
  }
}

function playNextMessage() {
  const msg = getNextMessage();
  if (msg) {
    // If user is GM, broadcast the message to all clients
    if (game.user.isGM) {
      game.socket.emit("module.abno-text", { message: msg });
      console.log("ABNO: Broadcasted message to all clients:", msg);
    }
    // GM also shows the message locally
    showAbnoMessage(msg);
  }
}

function startAutoMessages() {
  if (!game.settings.get("abno-text", "enabled") && game.user.isGM) return;
  const config = game.settings.get("abno-text", "config");
  if (intervalId) clearInterval(intervalId);
  if (config.frequency > 0) {
    intervalId = setInterval(playNextMessage, config.frequency * 1000);
    console.log("ABNO: Auto messages interval set to", config.frequency, "seconds");
  }
}


/* ---------------------------- */
/* CONFIG FORM                  */
/* ---------------------------- */
class AbnoTextConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { 
      id: "abno-text-config", 
      title: "Abno-Text Configuration", 
      template: "modules/abno-text/templates/settings.html", 
      width: 650,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false
    });
  }
  
  getData() { 
    return game.settings.get("abno-text", "config"); 
  }
  
  async _updateObject(event, formData) {
    console.log("ABNO: Saving config", formData);
    const data = foundry.utils.expandObject(formData);
    data.messages = data.messages.split("\n").map(m => m.trim()).filter(m => m.length > 0);
    data.randomMode = !!formData.randomMode;
    data.randomAngle = !!formData.randomAngle;
    data.autoScaleLongText = !!formData.autoScaleLongText;
    data.outlineEnabled = !!formData.outlineEnabled;
    
    await game.settings.set("abno-text", "config", data);
    sequenceIndex = 0;
    startAutoMessages();
    
    ui.notifications.info("Abno-Text configuration saved!");
    console.log("ABNO: Config saved successfully");
  }
}

/* ---------------------------- */
/* LOADOUT MENU - FIXED         */
/* ---------------------------- */
class AbnoLoadoutMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { 
      id: "abno-loadout-menu", 
      title: "Abno-Text Loadouts", 
      template: "modules/abno-text/templates/loadouts.html", 
      width: 500,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false
    });
  }
  
  getData() {
    const loadouts = game.settings.get("abno-text", "loadouts");
    const activeLoadout = game.settings.get("abno-text", "activeLoadout");
    
    // Asegurar que loadouts.custom existe
    if (!loadouts.custom) {
      loadouts.custom = {};
    }
    
    console.log("ABNO Loadouts getData:");
    console.log("  - Full loadouts object:", loadouts);
    console.log("  - Custom loadouts:", loadouts.custom);
    console.log("  - Number of custom loadouts:", Object.keys(loadouts.custom).length);
    console.log("  - Custom loadout names:", Object.keys(loadouts.custom));
    console.log("  - Active loadout:", activeLoadout);
    
    return { 
      loadouts: loadouts, 
      activeLoadout: activeLoadout 
    };
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    const currentConfig = game.settings.get("abno-text", "config");
    
    // Botón SAVE
    html.find("#save-loadout-btn").on("click", async (event) => {
      event.preventDefault();
      const name = html.find("#loadout-name-input").val().trim();
      console.log("ABNO: Save button clicked, name:", name);
      
      if (name && name.length > 0) {
        const loadouts = foundry.utils.duplicate(game.settings.get("abno-text", "loadouts"));
        loadouts.custom[name] = foundry.utils.duplicate(currentConfig);
        
        await game.settings.set("abno-text", "loadouts", loadouts);
        ui.notifications.info(`Loadout "${name}" saved!`);
        console.log("ABNO: Loadout saved successfully");
        
        // Limpiar input
        html.find("#loadout-name-input").val("");
        
        this.render();
      } else {
        ui.notifications.warn("Please enter a loadout name");
      }
    });
    
    // Botones LOAD
    html.find(".loadout-load-btn").on("click", async (event) => {
      event.preventDefault();
      const name = $(event.currentTarget).data("loadout");
      console.log("ABNO: Load button clicked for:", name);
      
      const loadouts = game.settings.get("abno-text", "loadouts");
      const selected = loadouts.custom[name];
      
      if (selected) {
        await game.settings.set("abno-text", "config", foundry.utils.duplicate(selected));
        await game.settings.set("abno-text", "activeLoadout", name);
        sequenceIndex = 0;
        startAutoMessages();
        ui.notifications.info(`Loadout "${name}" activated!`);
        console.log("ABNO: Loadout activated successfully");
        
        this.render();
      } else {
        ui.notifications.error(`Loadout "${name}" not found`);
      }
    });
    
    // Botones DELETE
    html.find(".loadout-delete-btn").on("click", async (event) => {
      event.preventDefault();
      const name = $(event.currentTarget).data("loadout");
      console.log("ABNO: Delete button clicked for:", name);
      
      const loadouts = foundry.utils.duplicate(game.settings.get("abno-text", "loadouts"));
      delete loadouts.custom[name];
      
      await game.settings.set("abno-text", "loadouts", loadouts);
      
      // Si estamos eliminando el loadout activo, volver a default
      if (game.settings.get("abno-text", "activeLoadout") === name) {
        await game.settings.set("abno-text", "activeLoadout", "default");
      }
      
      ui.notifications.info(`Loadout "${name}" deleted`);
      console.log("ABNO: Loadout deleted successfully");
      
      this.render();
    });
    
    // Botón RESTORE DEFAULT
    html.find("#restore-default-btn").on("click", async (event) => {
      event.preventDefault();
      console.log("ABNO: Restore default button clicked");
      
      await game.settings.set("abno-text", "activeLoadout", "default");
      ui.notifications.info("Default configuration activated");
      console.log("ABNO: Default loadout activated");
      
      this.render();
    });
  }
}
