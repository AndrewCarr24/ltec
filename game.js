const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // --- LIGHTING ---
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1;

    // --- CAMERA (FPS Style) ---
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(-14, 12, 27), scene);
    camera.attachControl(canvas, true);
    camera.speed = 0.8;
    camera.inertia = 0.8; // Added a little inertia for smoother movement

    camera.rotation.y = Math.PI;

    // Fixed key codes (use strings for consistency or the correct deprecated numbers)
    camera.keysUp = [87];    // W
    camera.keysDown = [83];  // S
    camera.keysLeft = [65];  // A
    camera.keysRight = [68]; // D

    // --- PHYSICS & COLLISIONS ---
    scene.collisionsEnabled = true;
    camera.checkCollisions = true;
    camera.applyGravity = true; // Let Babylon handle the gravity
    scene.gravity = new BABYLON.Vector3(0, -0.09, 0); // Standard gravity

    // The ellipsoid is the "hitbox" for your camera
    camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);

    // --- LOAD YOUR MAP ---
    BABYLON.SceneLoader.ImportMesh("", "./", "test_house2.glb", scene, function (meshes) {
        meshes.forEach(mesh => {
            mesh.checkCollisions = true;
        });
    });

    // --- POINTER LOCK ---
    canvas.addEventListener("click", () => {
        canvas.requestPointerLock();
    });

    // --- INPUT HANDLING ---
    const inputMap = {};
    let canJump = true;

    window.addEventListener("keydown", (e) => {
        inputMap[e.code] = true;

        // Jump Fix: Using cameraDirection for the built-in physics
        if (e.code === "Space" && canJump) {
            // We apply an upward force to the camera's internal direction
            camera.cameraDirection.y = .9;
            canJump = false;
            // Simple cooldown for jumping
            setTimeout(() => { canJump = true; }, 900);
        }

        if (e.key === "Shift") {
            camera.speed = 1;
        }
    });

    window.addEventListener("keyup", (e) => {
        inputMap[e.code] = false;
        if (e.key === "Shift") camera.speed = 0.4;
    });

    // --- GAME LOOP ---
    scene.onBeforeRenderObservable.add(() => {
        // Reset position if you fall off the map
        if (camera.position.y < -10) {
            camera.position = new BABYLON.Vector3(-14, 12, 27);
        }
    });

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());