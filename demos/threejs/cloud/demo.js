"use strict";

// SETTINGS of this demo :
const SETTINGS = {
    rotationOffsetX: 0, // negative -> look upper. in radians
    cameraFOV: 40,      // in degrees, 3D camera FOV
    pivotOffsetYZ: [0.2,0.2], // XYZ of the distance between the center of the cube and the pivot
    detectionThreshold: 0.5, // sensibility, between 0 and 1. Less -> more sensitive
    detectionHysteresis: 0.1,
    scale: 1 // scale of the 3D cube
};

// some globalz :
let THREEVIDEOTEXTURE
let THREERENDERER
let THREEFACEOBJ3D
let THREEFACEOBJ3DPIVOTED
let THREESCENE
let THREECAMERA;
let ISDETECTED = false;
let PARTICLES;
let CLOUDOBJ3D;


// callback : launched if a face is detected or lost. TODO : add a cool particle effect WoW !
function detect_callback(isDetected) {
    if (isDetected) {
        console.log('INFO in detect_callback() : DETECTED');
    } else {
        console.log('INFO in detect_callback() : LOST');
    }
}

// build the 3D. called once when Jeeliz Face Filter is OK
function init_threeScene(spec) {
    // INIT THE THREE.JS context
    THREERENDERER = new THREE.WebGLRenderer({
        context: spec.GL,
        canvas: spec.canvasElement
    });

    // COMPOSITE OBJECT WHICH WILL FOLLOW THE HEAD
    // in fact we create 2 objects to be able to shift the pivot point
    THREEFACEOBJ3D = new THREE.Object3D();
    THREEFACEOBJ3D.frustumCulled = false;
    THREEFACEOBJ3DPIVOTED = new THREE.Object3D();
    THREEFACEOBJ3DPIVOTED.frustumCulled = false;
    THREEFACEOBJ3DPIVOTED.position.set(0, -SETTINGS.pivotOffsetYZ[0], -SETTINGS.pivotOffsetYZ[1]);
    THREEFACEOBJ3DPIVOTED.scale.set(SETTINGS.scale, SETTINGS.scale, SETTINGS.scale);
    THREEFACEOBJ3D.add(THREEFACEOBJ3DPIVOTED);

    // CREATE THE CLOUD
    let CLOUDMESH;
    let LIGHTNINGMESH;
    PARTICLES = []

    // CREATE OUR CLOUD
    const loaderCloud = new THREE.BufferGeometryLoader()

    loaderCloud.load(
        './models/cloud.json',
        (geometry) => {
            const mat = new THREE.MeshPhongMaterial({
                map: new THREE.TextureLoader().load('./models/cloud.png'),
                shininess: 2,
                specular: 0xffffff,
                opacity: 0.6,
                transparent: true
            });

            CLOUDMESH = new THREE.Mesh(geometry, mat);
            CLOUDMESH.scale.multiplyScalar(0.5);
            CLOUDMESH.position.setY(0.45);
            CLOUDMESH.frustumCulled = false;
            CLOUDMESH.renderOrder = 10000;


            // CREATE OUR PARTICLE MATERIAL

            let PARTICLESOBJ3D = new THREE.Object3D();
            

            CLOUDOBJ3D = new THREE.Object3D();
            CLOUDOBJ3D.add(CLOUDMESH)
            CLOUDOBJ3D.add(PARTICLESOBJ3D);

            const particleMaterial = new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(generateSprite()),
                blending: THREE.AdditiveBlending
            });
            let particle
            for ( let i = 0; i <= 1000; i++ ) {
                particle = new THREE.Sprite(particleMaterial);
                particle.position.x = Math.random()*1.5 - 0.75
                particle.position.y = 2
                particle.renderOrder = 100000
                particle.scale.multiplyScalar(0.05)
                particle.visible = false;
                PARTICLES.push(particle);
                PARTICLESOBJ3D.add(particle);
            }

            PARTICLES.forEach((part, index) => {
                animateParticleCloud(part, index);
            });

            THREEFACEOBJ3DPIVOTED.add(CLOUDOBJ3D)
        }
    )

    // CREATE THE SCENE
    THREESCENE = new THREE.Scene();
    THREESCENE.add(THREEFACEOBJ3D);

    // init video texture with red
    THREEVIDEOTEXTURE = new THREE.DataTexture(new Uint8Array([255,0,0]), 1, 1, THREE.RGBFormat);
    THREEVIDEOTEXTURE.needsUpdate = true;

    // CREATE THE VIDEO BACKGROUND
    const videoMaterial = new THREE.RawShaderMaterial({
        depthWrite: false,
        depthTest: false,
        vertexShader: "attribute vec2 position;\n\
            varying vec2 vUV;\n\
            void main(void){\n\
                gl_Position=vec4(position, 0., 1.);\n\
                vUV=0.5+0.5*position;\n\
            }",
        fragmentShader: "precision lowp float;\n\
            uniform sampler2D samplerVideo;\n\
            varying vec2 vUV;\n\
            void main(void){\n\
                gl_FragColor=texture2D(samplerVideo, vUV);\n\
            }",
         uniforms:{
            samplerVideo: { value: THREEVIDEOTEXTURE }
         }
    });
    const videoGeometry = new THREE.BufferGeometry()
    const videoScreenCorners = new Float32Array([-1,-1,   1,-1,   1,1,   -1,1]);
    videoGeometry.addAttribute('position', new THREE.BufferAttribute( videoScreenCorners, 2));
    videoGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3]), 1));
    const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
    videoMesh.onAfterRender = function () {
        // replace THREEVIDEOTEXTURE.__webglTexture by the real video texture
        THREERENDERER.properties.update(THREEVIDEOTEXTURE, '__webglTexture', spec.videoTexture);
        delete(videoMesh.onAfterRender);
    };
    videoMesh.renderOrder = -1000; // render first
    videoMesh.frustumCulled = false;
    THREESCENE.add(videoMesh);

    // CREATE THE CAMERA
    const aspecRatio = spec.canvasElement.width / spec.canvasElement.height;
    THREECAMERA = new THREE.PerspectiveCamera(SETTINGS.cameraFOV, aspecRatio, 0.1, 100);
} // end init_threeScene()

// Creates our particles
function generateSprite(color) {
    var canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    var context = canvas.getContext('2d');
    var gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
    gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(0,255,255,1)');
    gradient.addColorStop(0.5, color ? color : 'blue');
    gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

// Animates our particles
function animateParticleCloud( particle, index ) {
    particle.visible = true;
    new TWEEN.Tween(particle.position)
        .to( { y: - 10 }, 4000)
        .delay(index*20)
        .repeat(Infinity)
        .onComplete(() => {
            particle.visible = false;
            animateParticle(particle, index);
        })
        .start();
}

// launched by body.onload() :
function main() {
    JEEFACEFILTERAPI.init({
        canvasId: 'jeeFaceFilterCanvas',
        NNCpath: '../../../dist/', // root of NNC.json file
        callbackReady: function (errCode, spec) {
            if (errCode) {
                console.log('AN ERROR HAPPENS. SORRY BRO :( . ERR =', errCode);
                return;
            }

            console.log('INFO : JEEFACEFILTERAPI IS READY');
            init_threeScene(spec);
        }, // end callbackReady()

        // called at each render iteration (drawing loop)
        callbackTrack: function (detectState) {
            if (ISDETECTED && detectState.detected < SETTINGS.detectionThreshold - SETTINGS.detectionHysteresis) {
                // DETECTION LOST
                detect_callback(false);
                ISDETECTED = false;
            } else if (!ISDETECTED && detectState.detected > SETTINGS.detectionThreshold + SETTINGS.detectionHysteresis) {
                // FACE DETECTED
                detect_callback(true);
                ISDETECTED = true;
            }

            if (ISDETECTED) {
                // move the cube in order to fit the head
                const tanFOV = Math.tan(THREECAMERA.aspect * THREECAMERA.fov * Math.PI / 360); // tan(FOV/2), in radians
                const W = detectState.s;  // relative width of the detection window (1-> whole width of the detection window)
                const D = 1 / (2 * W * tanFOV); // distance between the front face of the cube and the camera
                
                // coords in 2D of the center of the detection window in the viewport :
                const xv = detectState.x;
                const yv = detectState.y;
                
                // coords in 3D of the center of the cube (in the view coordinates system)
                const z = -D - 0.5;   // minus because view coordinate system Z goes backward. -0.5 because z is the coord of the center of the cube (not the front face)
                const x = xv * D * tanFOV;
                const y = yv * D * tanFOV / THREECAMERA.aspect;

                // move and rotate the cube
                THREEFACEOBJ3D.position.set(x, y + SETTINGS.pivotOffsetYZ[0], z + SETTINGS.pivotOffsetYZ[1]);
                THREEFACEOBJ3D.rotation.set(detectState.rx + SETTINGS.rotationOffsetX, detectState.ry, detectState.rz, "XYZ");
            }

            // reinitialize the state of THREE.JS because JEEFACEFILTER have changed stuffs
            THREERENDERER.state.reset();

            TWEEN.update()

            // trigger the render of the THREE.JS SCENE
            THREERENDERER.render(THREESCENE, THREECAMERA);
        } // end callbackTrack()
    }); // end JEEFACEFILTERAPI.init call
} // end main()

