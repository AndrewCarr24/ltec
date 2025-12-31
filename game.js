const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// Main async function to initialize Havok and create scene
async function main() {
    // Initialize Havok Physics
    const havokInstance = await HavokPhysics();

    const scene = new BABYLON.Scene(engine);

    // Enable Havok physics (slightly stronger gravity for less floaty feel)
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -14, 0), havokPlugin);

    // --- LIGHTING ---
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1;

    // 1. The "Sun" (Directional Light)
    const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-1, -2, -1), scene);
    sun.intensity = 2.0;
    sun.position = new BABYLON.Vector3(20, 40, 20);

    // 2. Enable Shadows
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, sun);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    // --- CAMERA (FPS Style) ---
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);
    camera.inertia = 0.8;
    camera.minZ = 0.1;

    // Remove default camera movement keys (we handle movement via physics)
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    // --- PLAYER CAPSULE (Physics Body) ---
    const playerHeight = 2.2; // Taller player
    const playerRadius = 0.4;

    // Create capsule mesh for player
    const playerMesh = BABYLON.MeshBuilder.CreateCapsule("player", {
        height: playerHeight,
        radius: playerRadius
    }, scene);
    playerMesh.position = new BABYLON.Vector3(-14, 13, 27);
    playerMesh.isVisible = false; // Invisible - we just see through the camera

    // Look into the room
    camera.rotation.y = Math.PI;

    // Create physics aggregate for player
    const playerAggregate = new BABYLON.PhysicsAggregate(
        playerMesh,
        BABYLON.PhysicsShapeType.CAPSULE,
        { mass: 70, friction: 0, restitution: 0 },
        scene
    );

    // Lock rotation to prevent tumbling
    playerAggregate.body.setMassProperties({
        inertia: BABYLON.Vector3.ZeroReadOnly
    });
    playerAggregate.body.disablePreStep = false;

    // --- MOVEMENT SETTINGS ---
    const walkSpeed = 5;
    const runSpeed = 10;
    const jumpForce = 7;
    let currentSpeed = walkSpeed;
    let isGrounded = false;

    // --- LOAD YOUR MAP ---
    BABYLON.SceneLoader.ImportMesh("", "./", "test_house3.glb", scene, function (meshes) {
        meshes.forEach(mesh => {
            // Add physics to each mesh (static bodies)
            if (mesh.name !== "__root__") {
                new BABYLON.PhysicsAggregate(
                    mesh,
                    BABYLON.PhysicsShapeType.MESH,
                    { mass: 0, friction: 0 }, // mass 0 = static
                    scene
                );
            }

            // 3. Tell objects to Cast/Receive shadows
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
        });
    });

    // --- POINTER LOCK ---
    canvas.addEventListener("click", () => {
        canvas.requestPointerLock();
    });

    // Mouse look sensitivity
    const mouseSensitivity = 0.002;

    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === canvas) {
            camera.rotation.y += e.movementX * mouseSensitivity;
            camera.rotation.x += e.movementY * mouseSensitivity;
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        }
    });

    // --- INPUT HANDLING ---
    const inputMap = {};

    window.addEventListener("keydown", (e) => {
        inputMap[e.code] = true;

        // Run with Shift
        if (e.key === "Shift") {
            currentSpeed = runSpeed;
        }
    });

    window.addEventListener("keyup", (e) => {
        inputMap[e.code] = false;
        if (e.key === "Shift") {
            currentSpeed = walkSpeed;
        }
    });

    // --- GROUND DETECTION ---
    function checkGrounded() {
        const rayStart = playerMesh.position.clone();
        const rayEnd = rayStart.add(new BABYLON.Vector3(0, -(playerHeight / 2 + 0.1), 0));

        const ray = new BABYLON.Ray(rayStart, BABYLON.Vector3.Down(), playerHeight / 2 + 0.2);
        const hit = scene.pickWithRay(ray, (mesh) => mesh !== playerMesh);

        return hit && hit.hit && hit.distance < playerHeight / 2 + 0.15;
    }

    // --- GAME LOOP ---
    scene.onBeforeRenderObservable.add(() => {
        // Update camera position to follow player
        camera.position = playerMesh.position.clone();
        camera.position.y += playerHeight / 2 + 0.3; // Eye level - higher up

        // Check if grounded
        isGrounded = checkGrounded();

        // Get current velocity
        const currentVelocity = playerAggregate.body.getLinearVelocity();

        // Calculate movement direction based on camera rotation
        const forward = new BABYLON.Vector3(
            Math.sin(camera.rotation.y),
            0,
            Math.cos(camera.rotation.y)
        );
        const right = new BABYLON.Vector3(
            Math.cos(camera.rotation.y),
            0,
            -Math.sin(camera.rotation.y)
        );

        // Calculate desired velocity
        let moveDirection = BABYLON.Vector3.Zero();

        if (inputMap["KeyW"]) moveDirection.addInPlace(forward);
        if (inputMap["KeyS"]) moveDirection.subtractInPlace(forward);
        if (inputMap["KeyA"]) moveDirection.subtractInPlace(right);
        if (inputMap["KeyD"]) moveDirection.addInPlace(right);

        // Normalize and scale by speed
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            moveDirection.scaleInPlace(currentSpeed);
        }

        // Set horizontal velocity, preserve vertical velocity
        playerAggregate.body.setLinearVelocity(
            new BABYLON.Vector3(moveDirection.x, currentVelocity.y, moveDirection.z)
        );

        // Jump
        if (inputMap["Space"] && isGrounded) {
            const vel = playerAggregate.body.getLinearVelocity();
            playerAggregate.body.setLinearVelocity(
                new BABYLON.Vector3(vel.x, jumpForce, vel.z)
            );
            inputMap["Space"] = false; // Prevent continuous jumping
        }

        // Arrow keys for looking
        const rotationSpeed = 0.03;
        if (inputMap["ArrowLeft"]) camera.rotation.y -= rotationSpeed;
        if (inputMap["ArrowRight"]) camera.rotation.y += rotationSpeed;
        if (inputMap["ArrowUp"]) camera.rotation.x -= rotationSpeed;
        if (inputMap["ArrowDown"]) camera.rotation.x += rotationSpeed;

        // Death / Reset
        if (playerMesh.position.y < -10) {
            playerMesh.position = new BABYLON.Vector3(-14, 13, 27);
            playerAggregate.body.setLinearVelocity(BABYLON.Vector3.Zero());
        }
    });

    // Start render loop
    engine.runRenderLoop(() => scene.render());
}

// Run the main function
main();

window.addEventListener("resize", () => engine.resize());