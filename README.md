# Crash Driver

A soft-body vehicle crash simulator in a single HTML file, styled after the 2013-era BeamNG.drive tech demos. Like BeamNG, the pickup truck is a classic mass-spring-damper network: 4500 nodes integrated explicitly at 2000 Hz (0.5 ms substeps) in a dedicated Web Worker. It has:

- 749 beams: structural, shear (diagonal) and support;
- 30 volume cells;
- a sheet-metal skin of 5780 stretch springs and 3643 dihedral bending springs.

In a crash the crumple zone folds progressively into an accordion and bulges sideways. The front piles up against a rigid engine block, and the hood folds up into a ridge like a roof. A corner hit twists the frame. Bumpers, hood and doors hang from their hinges or tear off when their brackets fail.

The tyres use a contact-patch friction model with slip ratio, slip angle and static/kinetic friction, on coil-over suspension with asymmetric dampers and anti-roll bars. The drivetrain is a full-size V8 pickup's: 0–100 km/h in 8 s and a 178 km/h limiter.

Tyre smoke, a little dust, radiator steam and sparks come from the physics itself: slipping tyres, metal scraping on concrete, beams snapping and the body slamming down.

## Run it

The page is plain HTML plus ES modules from jsDelivr (three.js r160), so any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

`index.html` is self-contained:

- It loads `models/gavril_d/scene.glb` when it can fetch it.
- If it can't (for example from `file://`), it builds a procedural placeholder pickup with the same part names and runs the same pipeline.
- `?model=path/to/vehicle.glb` loads another model (`.gltf` works too).
- `?worker=0` runs the solver on the main thread instead of the worker. The page also falls back to this on its own if workers are unavailable.
- `?tune={...}` deep-merges a JSON object into the vehicle constants (`VEHICLE`) before the truck is built, for example `?tune={"plastic":{"H":0.5}}`.
- `?time=day|evening|night` and `?gfx=low|medium|high|ultra` override the settings panel for that visit.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | W / ↑ | THROTTLE paddle |
| Brake (ABS); hold at a stop to reverse | S / ↓ | BRAKE paddle |
| Steer | A D / ← → | ◀ ▶ buttons |
| Reset vehicle | R | RESET VEHICLE |
| Cycle camera (chase, orbit, trackside) | C | CAM |
| Zoom in / out | + / − or the mouse wheel | + / − buttons, or pinch on the view |
| Headlights on / off | L | LIGHTS |
| f-node debug view | N | F-NODES |
| Slow motion: 20× slower (×0.05), still whole 0.5 ms substeps | T | SLOW-MO |
| Settings: time of day and graphics | G (Esc closes) | SETTINGS |
| Orbit camera | drag on the view | drag on the view |

The test bench has a concrete wall 45 m straight ahead of the spawn, a 10° ramp on the left lane and a 22° ramp on the right lane.

The HUD shows:
- the solver rate and load (step time plus skinning time per frame, on the worker). When the device can't keep up with real time, the rate turns red with the playback factor, for example `×0.62`;
- each tyre's share of the total load, so weight transfer is visible, with a tyre turning red while it slides;
- the body's lateral and longitudinal acceleration.

## Architecture

`index.html` has seven numbered sections. Section 1, `physicsLib()`, holds the whole simulation: solver, vehicle builder, drivetrain and skinning. It is one self-contained function with no DOM or three.js references.

**Worker thread.** Section 2 turns `physicsLib`'s source text into a Blob and starts a Web Worker from it. The main thread sends the model geometry once. After that, each frame it splits the elapsed time into 0.5 ms substeps and sends only how many are due, plus the driver input. The worker then:

1. runs the substeps;
2. skins the vehicle;
3. writes everything into one pooled `Float32Array` and transfers it back.

**Smooth under load.** A batch never holds more substeps than the worker can run in about 40 ms, less its skinning time. The page measures the worker's substep rate from its last batches, and the worker also stops a batch early once it has used 45 ms. A backlog beyond that is dropped. A heavy moment such as an impact (a substep then costs several times more) therefore plays as smooth slow motion for a few hundred milliseconds, never as a slideshow of large catch-up batches. A slow device likewise gets slow motion, never a larger step, and the HUD says by how much. The budget is generous so that a merely busy device still plays in real time.

**Warm-up.** At load, behind the loading screen, the worker simulates one short crash into the wall, skins a few frames and resets the truck completely. Every crash code path is compiled before the first real impact; otherwise the first impact's opening frames run unoptimised and stall the picture.

That buffer holds stats, node positions, beam states, wheel matrices and probe depths, skinned vertex positions and normals, and rigid-part matrices. The page points the meshes' `BufferAttribute.array`s straight into it and returns the previous buffer to the pool. Vertex data is never copied or allocated per frame.

**Spatial partitioning.** Static obstacles are indexed in a 4 m grid. Once per substep, each simulated body gathers the obstacles its bounding box overlaps, usually none or one. Per-node collision queries test only that list, and never other nodes. Flexnode clusters only wake when their own bounding box nears the ground or an obstacle, or when the structure under them is crumpling.

## The solver

**Substep.** Each 0.5 ms substep runs in four stages:

1. **Forces.** Every force on every node is summed: gravity, the coil-overs and tyres, drag, the air load on the hood and doors, the beam springs and dampers, the volume cells' pressure and the skin springs.
2. **Integration.** Semi-implicit (symplectic) Euler: v += F/m·dt, then x += v·dt.
3. **Contacts.** Contacts are resolved at the position level: crushed metal is pushed out of the engine and gearbox, then out of the ground and obstacles with Coulomb friction.
4. **Velocities.** A node a contact moved takes its velocity from its corrected position. Crushed members then get their friction lock.

**Stability.** Node positions and velocities live in flat `Float64Array`s. JavaScript does its arithmetic in doubles anyway, and stiff springs need that precision tens of metres from the origin; the buffers sent to the GPU are `Float32Array`s. An explicit spring is only stable while ω·dt < 2 at every node. `finalize()` therefore:

- bounds each node's highest spring frequency: a Gershgorin bound over its beams, plus the exact frequency of each volume cell it belongs to (a cell's pressure stiffness has rank one). Any node past 1.6 has its beams softened to fit, as a safety net for other models;
- lets a beam stiffen while it work-hardens only into the headroom below ω·dt = 1.3. That keeps room for the dampers: at a damping ratio of 0.35, symplectic Euler is stable only up to about 1.42. Nodes already near the limit, such as the light hood and door lattices, therefore don't stiffen further, which is what used to make a door hanging from one hinge vibrate;
- sizes the engine and gearbox lattices and the skin springs from their node masses.

**Nodes.**
- **Structural nodes:** 11 chassis cross-section rings, closer together in the front crumple zone, plus two-layer lattices for each detachable part.
- **Rigid blocks:** 8 corner nodes each for the engine and the gearbox.
- **Hubs:** 4, one per wheel centre.
- **Tread probes:** 256, a fixed 2 × 32 ring per wheel.
- **Flexnodes:** 4060 surface samples of the panels, which fill the matrix to exactly 4500 nodes.

**Beams.** Each beam is a spring-damper along its axis: F = k·(L − L0) + c·v<sub>rel</sub>, with k = E/L0 and c set by the family's damping ratio. There are three kinds:

- **Structural:** the ring edges, the rails between rings and the part lattice edges. They hold the shape.
- **Shear:** the ring diagonals, the crossing diagonals of every bay face, the rail-to-rail twist bracing and the lattice face diagonals. They stop bays and panels shearing into parallelograms.
- **Support:** hidden struts that only push. Twelve run corner to corner across and along the cab, and engage only once the cab is crushed past 12 % of their length, so it can't fold down to nothing. Others rest the hood on the fenders and the doors on the sills.

Plasticity and fracture:

- **Plastic set:** once a beam is stretched or compressed more than 5 % beyond its rest length (`msd.yield`), its rest length moves for good. It keeps its new length, like crumpled metal.
- **Packed metal:** below 32 % of its factory length a beam stops flowing.
- **Breaking:** a beam stretched more than 30 % past its factory length (`msd.break`) is deleted from its body's live beam list (swapped with the last live beam). Under compression, structural metal crumples instead of snapping. Mounting brackets also tear once their plastic budget is used up, and keep their own tuned limits.

**Volume cells.** Every bay between two chassis rings is a closed hexagonal prism, and every part lattice cube is a hexahedron. Each is a pressure spring: p = K·(V0 − V)/V0 pushes its corners along the exact closed-surface volume gradient, with damping on the rate of volume change. Past the cell's yield pressure, the rest volume flows plastically between a floor and a ceiling. Below the floor it densifies: its yield pressure climbs steeply, but it keeps flowing rather than storing the crush as a spring.

**Engine and gearbox.** Each is a lattice of 12 edges, 6 face diagonals and 4 body diagonals, as stiff as the substep allows for their node masses (ω·dt ≈ 0.9). They carry 230 kg and 95 kg on plastic mounts, and the gearbox bolts to the back of the engine.

Crumple-zone beams that are driven into a block are pushed back out of it. The front therefore has to fold up ahead of the engine, and only a hard enough hit shoves the engine back toward the firewall.

This contact is inelastic, so it can only take energy out:

- Only the penetration a step adds is removed. It is measured through the same face in the block's previous frame, so the block's own spin counts.
- The block takes the reaction at the contact point itself, spread over its eight corners by trilinear weights.

An earlier version pushed the whole depth out every step and moved the block as a whole. That fired crushed metal off a spinning block, and after an 85 km/h angled hit it kept spinning the airborne truck up into a cartwheel.

**Contacts.** Contacts are position-based. A node is projected out along the contact normal, then Coulomb friction acts on that step's tangential displacement: static while it is within μ times the normal correction, kinetic sliding beyond that. Only the penetration created by this step's own approach may turn into velocity, and only that fresh penetration sets the friction limit. Anything deeper is eased out without launching the body or gluing it to a wall.

**Flexnodes (the skin sheet).** Every flexnode follows a smooth blend of the 6 nearest structural nodes of its part (embedded deformation):

- **Node rotations:** each structural node carries its own rotation, shape-matched over itself and its beam neighbours.
- **Smooth weights:** the weights fade to zero at the next node out, so neighbouring flexnodes always blend almost the same nodes.
- **Awake flexnodes:** each hangs on its sheet target with a spring-damper (520 rad/s, half critical damping), and the reaction goes back to the structural nodes it blends. The tie is firm within the surface but only 12 % as stiff along the surface normal, so the sheet springs can buckle a squeezed panel out of its plane.
- **Sheet mesh:** the panel meshes are clustered into a coarse triangle mesh over the flexnodes. Each of its edges is a stretch spring, which yields plastically and tears past 60 % stretch. Each edge shared by two triangles is a dihedral bending spring (mechanic 1 below). A 27 g flexnode can't carry a very stiff sheet at the substep, so each spring is capped at its share of its nodes' stable frequency. A crushed triangle folding nearly flat makes a hinge's stiffness grow like 1/height², so each hinge is held at four times its rest stiffness; without that cap, skin flexnodes were fired off at impact as giant stretched sheets.
- **Dents:** deviation past about 1 cm becomes a permanent rest-space offset. Sleeping surface neighbours within 24 cm take a smoothly falling share of it, so the patch sets together as one bowl or crease.
- **Sleeping:** a flexnode that has settled, or has been awake for 0.2 s, bakes its dent and goes back to sleep. Sleeping flexnodes are kinematic and cost nothing. At most 500 flexnodes are woken by crumpling at once; contacts always wake them. The wake test runs every second substep (1 kHz), which is enough because its 2.5 cm margin covers 1 ms of travel at crash speed. A flexnode clearly out of reach of the ground and every obstacle (its distance from its dominant structural node is bounded) is skipped without computing its target.

## Metal deformation mechanics

Ten mechanics run inside the mass-spring loop on top of the beams, cells and sheet above. The constants live in `VEHICLE` and can be changed with `?tune=`.

1. **Dihedral bending springs.** Every pair of adjacent sheet triangles carries a torsion spring on the angle between their faces, using Bridson's exact dihedral gradient (`dihedral()`, `sheetForces()`). Its stiffness is `sheet.kBend`, capped for the substep. A contact therefore spreads into one wide, continuous fold across the hood and fenders instead of a field of spikes. Past `sheet.bendYield` (0.3 rad) the fold angle sets plastically, which forms a permanent crease.
2. **Logarithmic work hardening.** Each beam accumulates plastic strain ε<sub>p</sub>. Its yield force grows as F<sub>y</sub> = F<sub>y0</sub>·(1 + H·ln(1 + ε<sub>p</sub>/ε<sub>0</sub>)) (`plastic.H`, `plastic.eps0`). Its stiffness grows by that factor squared times (1 + ε<sub>p</sub>/`epsK`), as far as the substep allows: a buckled member unloads along a stiffer path. Crushed metal therefore gets stronger and springs back less, and the crush moves on into the next undeformed bay rather than folding one bay flat.
3. **Stress-induced volume expansion.** A bay crushed lengthwise keeps its pressure, which pushes its side walls out against cross members that yield in tension at just 1.2 % (`cross.yieldT`). The crushed bay therefore bursts outward: fenders bulge and the hood arches up into its fold. The pressure always acts along the exact volume gradient. An earlier version pushed only sideways, but that force is non-conservative and pumped energy into the ringing structure after a crash.
4. **Delayed impulse shockwave.** Explicit integration carries an impulse at most one beam further per 0.5 ms substep, so a hit runs from the bumper back to the cab as a wave at the structure's speed of sound, visible frame by frame in slow motion.
5. **Non-linear plastic flow (viscoplasticity).** Fast deformation raises the yield, following Cowper-Symonds: y·(1 + (ε̇/D)<sup>1/q</sup>) (`plastic.D`, `plastic.q`). In the peak milliseconds of a crash a member carries more than its static yield and flows like heavy, viscous metal rather than giving at once.
6. **Hinged hood flapping.** The hood's latch tears open after its first beam fails in tension, while its two rear hinge brackets keep holding. Each hood and door panel carries flat-plate aerodynamic pressure (`aeroParts()`, `air.Cn`). With the inertia of its lattice, that lifts an unlatched hood: it flaps, slams, and pivots on its rear hinges.
7. **Edge-tearing propagation.** When an attachment beam snaps, every unbroken attachment beam next to it along the panel edge has its tensile stress doubled, capped at 4× (`concentrate()`). Its neighbours are the beams on the same panel node or one lattice beam away. A torn corner therefore unzips along the seam, and a bracket that has lost half its beams fails as a unit.
8. **Frictional plastic damping.** A beam whose rest length has changed by more than 10 % of its factory length (`plastic.lockStrain`) gets Coulomb friction between its two nodes: up to `plastic.lockDecel` (40 m/s²) of their relative motion is taken off (`beamFriction()`). It acts at the velocity level, beam by beam, so it can stick without overshooting the way an explicit friction force would. Crushed metal locks into shape instead of wobbling like jelly once the crash is over.
9. **Stretch-limit thinning.** Plastic stretch thins the metal: a beam's breaking strain shrinks to max(`thinMin`, 1 − `thin`·ε<sub>stretch</sub>) of its original value. Sheet edges tear the same way. Panel triangles stretched past 1.8× are cut out of the rendered mesh, so overstretched metal splits into strips.
10. **Shear twist diagonals.** Stiff diagonal shear beams (`frameX`) brace the left and right rails, each spanning two chassis bays. A corner impact therefore twists the whole frame, cab and bed instead of folding one rail on its own.

## Detaching parts

Parts come from GLTF node names: Chassis, Front Bumper, Rear Bumper, Left Door, Right Door and Hood. Each hangs on named brackets of attachment beams:

| Part | Brackets |
| --- | --- |
| Doors | upper hinge, lower hinge, latch |
| Hood | left hinge, right hinge, latch |
| Bumpers | one per bolt |

- **Bracket failure:** a bracket lets go as a unit after losing half its beams (a hood latch after its first). Failures stay local, so a door whose upper hinge and latch tear off swings and hangs on its lower hinge.
- **Load sharing:** each snapped beam concentrates stress in its bracket neighbours (mechanic 7). A moderate hit leaves a part hanging; a severe one tears it free as one panel.
- **Free parts:** a part with no brackets left moves into its own simulation context with exactly the momentum it had, keeps deforming, and goes to sleep once it comes to rest.

**The hood's roof fold.** The hood is a 3 × 5 × 2 lattice, from the hinge row at the cowl to the latch at the front:

- Around the middle row, every member gives early and sets plastically (`hoodFold`, 1.2 % yield).
- Its outer segments stay stiff (`hoodPanel`). The hood is crowned, so it folds up rather than down.
- The latch is a hook: it tears open in tension, but under compression it keeps pushing the hood back as the front crushes.

A frontal hit therefore folds the hood up into a ridge with two flat halves, like a roof: about 45 cm high after a 60 km/h wall hit and 29 cm after 40 km/h. The supports underneath stop it folding down onto the engine.

## Vehicle dynamics

**Suspension.** Each hub sits on a coil-over along the chassis "up" direction:
- a linear spring with the static preload;
- digressive dampers, with rebound about 2.5× stiffer than bump and both softening past 0.13 m/s;
- progressive bump and droop stops;
- front and rear anti-roll bars.

Laterally and fore-aft the hub is held by a stiff link that bends plastically in crashes.

**Tyres.**
- **Normal force:** the probe ring measures how far the tyre is compressed against the world, which gives the radial force.
- **Friction:** friction acts at a single contact patch per wheel. The patch deflects with the slip velocity and relaxes over a relaxation length while rolling. That gives slip-ratio and slip-angle forces at speed, and true static friction at a standstill: the truck holds still on the 10° ramp with the brake on.
- **Friction limit:** the force is capped by a Coulomb limit that falls from the static (peak) value to the kinetic one as slip grows, with load sensitivity. The peak, μ = 0.92 falling to 0.70 sliding, is an all-season light-truck tyre on dry concrete.
- **Spin coupling:** wheel spin is coupled implicitly through the patch damping.
- **Moments:** the patch moment goes to the body with its full lever arm from the ground, so weight transfer under braking, acceleration and cornering comes out of the geometry.

**Drivetrain.** The Gavril D-Series is BeamNG's take on a full-size pickup like the Ford F-150, so the truck carries that class's V8 drivetrain:

| | |
| --- | --- |
| Engine | 5.0 L V8, about 245 hp at 4500 rpm, 425 N·m at 3500 rpm, from a torque curve table; rev limiter at 5600 rpm |
| Gearbox | 4-speed automatic (2.71, 1.54, 1.00, 0.71; reverse 2.18), 3.55 axle |
| Torque converter | multiplies torque up to its stall speed, which rises with throttle; locks up in 3rd and 4th |
| Shift schedule | later upshifts and earlier kickdowns the harder the throttle is pressed |
| 4WD | 40/60 front/rear torque split, viscous limited-slip axles |
| Brakes | four-channel ABS |
| Drag and rolling resistance | CdA 1.45 m², light-truck tyres at 0.015 |
| Speed limiter | 178 km/h, like a road truck's |

Measured on the bench: 0–100 km/h in 8.0 s (0–60 mph in 7.6 s), 178 km/h on the limiter, and 100–0 km/h braking in about 46 m. Steering uses Ackermann geometry, with about 29° of lock at rest (a 12 m turning circle) and less at speed.

## Settings

The SETTINGS button (or G) opens a panel with two choices. They are remembered in this browser.

**Time of day:**

| Time | Sky | Light |
| --- | --- | --- |
| Day | Pale blue | High sun |
| Evening | Orange horizon under a deep blue zenith | Low warm sun, long shadows; headlights and floodlights at half strength |
| Night | Dark, with stars | Dim blue moonlight; working headlight beams, glowing tail lights and five floodlight poles over the test area |

Each time sets the sky colours, the sun or moon direction, colour and strength, the hemisphere fill, the reflections (re-rendered from that sky), exposure, haze and bloom. At night the HUD text turns light on a dark halo.

The truck's lights switch on by themselves in the evening and at night. LIGHTS (or L) turns them on or off at any time; in daylight a switched-on beam runs at half strength.

**Graphics:**

| Preset | Resolution | Sun shadows | Anti-aliasing | Skin detail (awake flexnodes, normals) | Smoke / spark particles | Extras |
| --- | --- | --- | --- | --- | --- | --- |
| LOW | ¾ | off | FXAA | 150, 8000 triangles | 220 / 90 | no bloom, two floodlights |
| MEDIUM | 1× | 1024 px | FXAA | 300, 14,000 triangles | 600 / 220 | bloom |
| HIGH | up to 1.5× | 2048 px | 4× MSAA | 500, 20,000 triangles | 1200 / 450 | bloom |
| ULTRA | up to 2× | 4096 px | 8× MSAA | 800, 30,000 triangles | 2400 / 900 | bloom, headlight shadows |

Each preset also scales how densely the effects emit (0.4× on LOW up to 1.6× on ULTRA).

The default is HIGH on desktop and MEDIUM on touch devices.

## Rendering

- **Lighting:**
  - **Sun:** a directional light with cascaded shadow maps. The nearest cascade covers only about 11 m around the car, which gives sharp contact shadows under the chassis.
  - **Fill:** a hemisphere sky-bounce light, with image-based reflections from the sky. There is no flat ambient light.
  - **Post:** an HDR render goes through a light bloom and ACES tone mapping, then MSAA or FXAA depending on the graphics preset.
- **Materials:** physically based. Clearcoat sand paint, matte rough rubber, glass headlight lenses over emissive reflectors, a satin grille split out of the fascia, a dark radiator with a micro-grid texture, and chrome bumpers. The ground is a clean grey checker gridmap.
- **Skinning:** panel vertices ride on their four nearest same-side flexnodes, rotated with each flexnode's blended node rotation. The weights fade to zero at the fifth-nearest flexnode, so there are no seams. Normals are recomputed once a panel is dented. The panels take turns under a budget of 20,000 triangles per frame, since a crash dents many at once; a panel waiting for its turn shows its rotated rest normals.
- **Accordion pleats:** a crushed bay can't shorten its sheet metal, so the fenders, wheel tubs and body sides ahead of the cowl fold into sharp pleats across it. The pleats are a triangle wave of 24 cm rest wavelength, standing (λ/4)·√(1 − r²) high (deepened 1.4× so they read clearly) for a bay squeezed to a fraction r of its length. Normals are recomputed, so the folds catch the light.
- **Torn metal:** triangles of a dented panel that stretch past 1.8× along an edge are removed from the mesh on both the worker and the page, so the panel opens up into strips.
- **Rigid parts:** the engine and gearbox meshes ride on their blocks. Radiator and suspension parts in the engine bay are skinned to the structure. All the dark mechanical parts ahead of the cowl (engine, manifold, battery and airbox, radiator, front suspension and steering) are hidden once the crumple zone shortens by 3 cm, so a crash never shows them as black shards through the panels.
- **Wheels:** the stock GLTF wheels are measured and removed. The generated wheels (tyre, rim, instanced lug nuts, disc and caliper) spin, steer, and squash where the probes report compression.

## Effects

The physics thread reports, per wheel, how fast the tyre's contact patch slips and how fast it rolls. It also reports a sample of its effect events and how many of each kind it saw:

- metal sliding on concrete faster than 3 m/s;
- a node slammed into the ground or a wall faster than 4 m/s;
- a beam snapping.

A scraping node raises an event every 0.5 ms substep, so each sampled event stands for its share of the batch's count. Effects are therefore a rate per second, the same at any frame rate.

| Effect | Source | Look |
| --- | --- | --- |
| Tyre smoke | a tyre slipping faster than 1.5 m/s: burnouts, locked brakes, drifts | white puffs from the contact patch that billow to 3–5 m and drift for 4–7 s |
| Dust | a little grit from tyres rolling fast or slipping, metal scraping, and impacts; a big impact's dust is capped per batch | low brown-grey puffs that settle quickly |
| Radiator steam | the crumple zone crushed past 8 cm | coolant steam rising from the grille for half a minute, fading; after a very hard hit, puffs of dark smoke mixed in |
| Sparks | about 12 sparks per second per scraping node for each m/s of sliding, plus a burst per snapped beam | hot additive streaks stretched along their velocity, cooling from white through yellow to red; they fall, bounce off the ground and bloom |

Smoke, dust and steam are camera-facing billboards cut from a procedural puff atlas and sorted back to front. They take the time of day's sun and sky colour, with bright tops and shaded undersides, so they read as volumes in daylight and glow orange in the evening. Everything advances with simulation time, so slow motion slows the smoke too.

## Vehicle model and licence

`models/gavril_d/scene.glb` is "Gavril_D_ Beamng" by [akhikavi7](https://sketchfab.com/akhikavi7), from [Sketchfab](https://sketchfab.com/3d-models/gavril-d--beamng-16aa7bf3a00e4d4fb74edc52fda042f5), licensed CC-BY-4.0 (see `models/gavril_d/license.txt`). It was repacked losslessly from the original `.gltf` + `.bin` into a single GLB. The in-game HUD shows the same credit.
