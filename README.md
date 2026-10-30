# Beams.Web

A soft-body vehicle crash simulator in a single HTML file, styled after the 2013-era BeamNG.drive tech demos. Like BeamNG, the pickup truck is a classic mass-spring-damper network: 4500 nodes integrated explicitly at 2000 Hz (0.5 ms substeps) in a dedicated Web Worker. It has:

- 1034 beams: structural, shear (diagonal) and support;
- 45 volume cells;
- a sheet-metal skin of 5574 stretch springs and 3458 dihedral bending springs.

In a crash the crumple zone folds progressively into an accordion and bulges sideways. The front piles up against a rigid engine block, and the hood folds up into a ridge like a roof. A corner hit twists the frame. Bumpers, hood, doors, front fenders, tailgate, headlights, grille and taillights hang from their hinges, bolts and clips or tear off when their brackets fail; an offset hit leaves the front bumper dangling from one end.

The truck gets dirty as it drives, with mud low on the body and sprayed up behind the wheels. The test area is a white gridmap under a blue sky with clouds, ringed by pale dunes, with ruled grey blocks, a steel post, a suspension test course, a drag strip, a skid pad and palm islands.

The tyres use a contact-patch friction model with slip ratio, slip angle and static/kinetic friction, on coil-over suspension with asymmetric dampers and anti-roll bars. The drivetrain is a full-size V8 pickup's: 0–100 km/h in 8 s and a 178 km/h limiter.

Tyre smoke, impact dust, flying debris, radiator steam and sparks come from the physics itself: slipping tyres, metal scraping on concrete, beams snapping and the body slamming into the wall or the floor.

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
- `?time=day|evening|night`, `?gfx=low|medium|high|ultra` and `?deform=simple|normal|enhanced` override the menu's choices for that visit.
- `?menu=0` skips the main menu and starts straight in the game.

## Main menu

The game opens on a title screen in the style of an early-2010s simulator alpha.

- **Background:** a live view of the test area in black and white, with the contrast pulled up and a heavy vignette. On the title screen the truck waits in the yard behind the crash wall, between the wall's shadowed back and the container stacks, and the camera drifts slowly down the yard.
- **Title:** "Beams.Web" in large white type at the upper left, with an orange dot.
- **Lower right:** the Beams.Web mark with a blue wordmark, and plain desktop buttons: Play, Options and Exit. When a session is in progress, Resume comes first. The mark is a soft-body spring element: an orange node joined to two square steel nodes, one by a beam and one by a coil spring, with a beam bracing the pair.

What the buttons do:

- **Play** opens a Choose Level window over the dimmed menu. It shows a large preview of GridMap and three thumbnails, one each for day, evening and night. The previews are rendered from the live scene in colour the first time the window opens. Picking a thumbnail sets the time of day, and **Go!** starts the level with a fresh truck at the start line. Arrow keys move between the thumbnails, and a double-click on one starts it.
- **Options** opens the settings (deformation and graphics) as a desktop window.
- **Exit** closes the game to a black screen. A click or a key brings the menu back.

In the game, **Esc** or the **MENU** button opens the menu and pauses the physics. **Resume** carries on where you left off. **Esc** also closes any open window and, from the pause menu, resumes.

The windows and buttons are drawn in a plain desktop style (Segoe UI, light grey, white title bars). The title and wordmark use Ubuntu. On a phone the buttons fill the width of the screen and the Choose Level window stacks its preview, thumbnails and description.

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
| Settings: deformation and graphics | G (Esc closes) | SETTINGS |
| Main menu (pauses) | Esc | MENU |
| Orbit camera | drag on the view | drag on the view |

The chase camera holds the truck's heading closely, so a hard turn doesn't show the truck from the side as if it slid. Its lens widens a little with speed.

The test area is the classic gridmap: a white floor ruled every 0.5 m in fine grey lines inside 4 m squares edged in heavy black, under a deep blue sky with drifting fair-weather cumulus. Every obstacle is a block ruled the same way in a cool grey, which the sky turns blue on its shaded faces. Pale sand dunes ring the horizon, and two islands of sand, bushes and palms stand off to the right (scenery only). Markings are painted straight on the grid in yellow, with dark lettering. The floodlight poles stand only in the evening and at night.

Seen from the spawn (+x is to the left):

| Feature | Where | For |
| --- | --- | --- |
| Concrete wall, 18 m wide and 5 m tall | 45 m straight ahead; yellow lines on the run-up mark the distance every 5 m | full-width frontal hits |
| Ramps of 10° and 22° | either side of the run-up | jumps and rollovers |
| Steel post, 0.4 m square | right of the wall | narrow-object hits |
| Short concrete block, 6 m wide and 1.6 m tall | right of the wall | small-overlap hits |
| Grid blocks, some stacked two high | behind the wall | a backdrop to hit |
| Suspension test course: an asphalt lane with four speed humps, a twist section, a washboard and two kerbs, plus a 15° ramp beside it for one wheel | 44 m left, from 30 m behind the spawn to the wall's end | suspension travel, articulation and damping |
| Asphalt drag strip, 2 km, with the distance painted every 100 m | 60 m left, starting 900 m behind the spawn | acceleration and top speed |
| Asphalt skid pad, 30 m radius, with painted circles | 95 m left, 45 m behind | cornering and drifts |
| Sand dunes; palm islands | on the horizon; off to the right | — |

The suspension course, driven toward the wall end:

| Section | What it is | What it shows |
| --- | --- | --- |
| BUMPS | four 10 cm speed humps across the lane, 6 m apart | bump and rebound damping, pitch |
| TWIST | six 16 cm humps, each under one wheel track, alternating sides 3.5 m apart | axles articulating against each other, body roll and twist |
| WASHBOARD | 18 ridges of 3.5 cm, 55 cm apart | high-frequency damping |
| KERBS | a 12 cm kerb across the lane, then a 20 cm kerb under the left wheels | sharp edges, a one-sided hit |
| RTI 15° | a 4 m ramp, 1.1 m wide, beside the lane | how far one wheel can climb before another lifts |

The humps are smooth raised-cosine profiles in the physics (their own collider type, with the slope's normal), not boxes, so the tyres roll over them. Each section is named on the floor.

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

**Smooth under load.** A batch never holds more substeps than the worker can run in about 40 ms, less its skinning time. The page measures the worker's substep rate from its last batches, and the worker also stops a batch early once it has used 45 ms. A backlog beyond that is dropped. A heavy moment such as an impact (a substep then costs several times more) therefore plays as smooth slow motion for a few hundred milliseconds, never as a slideshow of large catch-up batches. A slow device likewise gets slow motion, never a larger step, and the HUD says by how much: it counts the substeps the worker actually ran, so a batch cut short shows too. The budget is generous so that a merely busy device still plays in real time.

**Cost.** On a desktop CPU a 60 Hz frame of driving costs the worker about 4 ms: about 2.6 ms for its 33 substeps and about 1.2 ms to skin and pack. That leaves room for devices several times slower to keep real time. Three things keep the substep cheap while nothing is crashing:

- the engine-block contact rejects a beam with one AND of its two ends' slab codes;
- a skin flexnode clear of the ground isn't tested again until it could have come down to the wake margin;
- work-hardening factors are cached per beam and recomputed only when the beam flows.

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
- **Flexnodes:** 3976 surface samples of the panels, which fill the matrix to exactly 4500 nodes.

**Beams.** Each beam is a spring-damper along its axis: F = k·(L − L0) + c·v<sub>rel</sub>, with k = E/L0 and c set by the family's damping ratio. There are three kinds:

- **Structural:** the ring edges, the rails between rings and the part lattice edges. They hold the shape.
- **Shear:** the ring diagonals, the crossing diagonals of every bay face, the rail-to-rail twist bracing and the lattice face diagonals. They stop bays and panels shearing into parallelograms.
- **Support:** hidden struts that only push. Twelve run corner to corner across and along the cab, and engage only once the cab is crushed past 12 % of their length, so it can't fold down to nothing. Others rest the hood on the fenders and the doors on the sills.

Plasticity and fracture:

- **Plastic set:** once a beam is stretched or compressed more than 5 % beyond its rest length (`msd.yield`), its rest length moves for good. It keeps its new length, like crumpled metal.
- **Packed metal:** below 18 % of its factory length a beam stops flowing.
- **Breaking:** a beam stretched more than 30 % past its factory length (`msd.break`) is deleted from its body's live beam list (swapped with the last live beam). Under compression, structural metal crumples instead of snapping. Mounting brackets also tear once their plastic budget is used up, and keep their own tuned limits.

**Volume cells.** Every bay between two chassis rings is a closed hexagonal prism, and every part lattice cube is a hexahedron. Each is a pressure spring: p = K·(V0 − V)/V0 pushes its corners along the exact closed-surface volume gradient, with damping on the rate of volume change. Past the cell's yield pressure, the rest volume flows plastically between a floor and a ceiling. Below the floor it densifies: its yield pressure climbs steeply, but it keeps flowing rather than storing the crush as a spring.

**Engine and gearbox.** Each is a lattice of 12 edges, 6 face diagonals and 4 body diagonals, as stiff as the substep allows for their node masses (ω·dt ≈ 0.9). They carry 230 kg and 95 kg on plastic mounts, and the gearbox bolts to the back of the engine.

Crumple-zone beams that are driven into a block are pushed back out of it. The front therefore has to fold up ahead of the engine, and only a hard enough hit shoves the engine back toward the firewall. Every substep, each candidate node gets a 6-bit code for which of the box's faces it lies beyond. A beam whose two ends share a bit lies wholly outside the box, which is convex, so only the few left over are sampled.

This contact is inelastic, so it can only take energy out:

- Only the penetration a step adds is removed. It is measured through the same face in the block's previous frame, so the block's own spin counts.
- The block takes the reaction at the contact point itself, spread over its eight corners by trilinear weights.

An earlier version pushed the whole depth out every step and moved the block as a whole. That fired crushed metal off a spinning block, and after an 85 km/h angled hit it kept spinning the airborne truck up into a cartwheel.

**Contacts.** Contacts are position-based. A node is projected out along the contact normal, then Coulomb friction acts on that step's tangential displacement: static while it is within μ times the normal correction, kinetic sliding beyond that. Only the penetration created by this step's own approach may turn into velocity, and only that fresh penetration sets the friction limit. Anything deeper is eased out without launching the body or gluing it to a wall.

**Beams against obstacles.** A post narrower than the node spacing would slip between the nodes and meet only the skin. The skin's ties then sprang the truck back off it, at two-thirds of its impact speed. So each structural beam crossing a box is tested too. Its point nearest the box's vertical axis is pushed back out, inelastically like the engine-block contact: only the depth this step added, at most 2 cm, through the face it came in by. Points within 15 % of a beam's ends are left to that node's own contact. There a light node at the far end would take the whole correction magnified and be fired off. The test costs nothing away from obstacles.

**Flexnodes (the skin sheet).** Every flexnode follows a smooth blend of the 6 nearest structural nodes of its part (embedded deformation):

- **Node rotations:** each structural node carries its own rotation, shape-matched over itself and its beam neighbours.
- **Smooth weights:** the weights fade to zero at the next node out, so neighbouring flexnodes always blend almost the same nodes.
- **Awake flexnodes:** each hangs on its sheet target with a spring-damper (520 rad/s, half critical damping), and the reaction goes back to the structural nodes it blends. The tie is firm within the surface but only 12 % as stiff along the surface normal, so the sheet springs can buckle a squeezed panel out of its plane.
- **Sheet mesh:** the panel meshes are clustered into a coarse triangle mesh over the flexnodes. Each of its edges is a stretch spring, which yields plastically and tears past 60 % stretch. Each edge shared by two triangles is a dihedral bending spring (mechanic 1 below). A 27 g flexnode can't carry a very stiff sheet at the substep, so each spring is capped at its share of its nodes' stable frequency. A crushed triangle folding nearly flat makes a hinge's stiffness grow like 1/height², so each hinge is held at four times its rest stiffness; without that cap, skin flexnodes were fired off at impact as giant stretched sheets.
- **Dents:** deviation past about 1 cm becomes a permanent rest-space offset. Sleeping surface neighbours within 24 cm take a smoothly falling share of it, so the patch sets together as one bowl or crease.
- **Sleeping:** a flexnode that has settled, or has been awake for 0.2 s, bakes its dent and goes back to sleep. While only the ground is near, a sleeping flexnode found clear of it is next tested once it could have come down to the 2.5 cm margin, at its structure's sink rate plus 3 m/s. Sleeping flexnodes are kinematic and cost nothing. At most 500 flexnodes (the DEFORMATION setting: 0 on SIMPLIFIED, 1100 on ENHANCED) are woken by crumpling at once; contacts always wake them, except on SIMPLIFIED. The wake test runs every second substep (1 kHz), which is enough because its 2.5 cm margin covers 1 ms of travel at crash speed. A flexnode clearly out of reach of the ground and every obstacle (its distance from its dominant structural node is bounded) is skipped without computing its target.

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

## How hard it crashes

The truck is built like a 1990s body-on-frame pickup: it has no engineered crumple zone, and its cab is strong but not a safety cage.

| Wall hit | Front crush | Engine pushed back | What it looks like |
| --- | --- | --- | --- |
| 30 km/h | ~7 cm | — | bumper and grille pushed in, a fender bolt or two gone |
| 50 km/h | ~28 cm | 10 cm | the nose folds, the hood ridges up, headlights smash, a fender hangs or falls |
| 80 km/h | ~47 cm | 31 cm | the front crushed to the wheels, the windshield cracked across, the frame twisted |
| 100 km/h | ~53 cm | 40 cm | the engine driven into the firewall, the cab's front folding with the A-pillars bent and the floor buckled, a front wheel shoved back, the fenders torn off |

Two visual cues come from the crush itself:

- **Headlights:** once the front has crushed 15 cm the headlights are smashed. Their lenses and turn-signal glass are gone and they stay dark, though the tail lights still work.
- **Windshield:** past about 20 cm the windshield cracks. A crushed white star forms at a random point near its base, with spokes and broken rings running out from it, and the cracks reach further the harder the hit.

RESET VEHICLE repairs both.

## Detaching parts

Parts come from GLTF node names: Chassis, Front Bumper, Rear Bumper, Left Door, Right Door, Hood, the left and right front fenders, the tailgate, the left and right headlights and the left and right taillights. The grille is cut out of the fascia (the triangles between the headlights) into a part of its own. Each part hangs on named brackets of attachment beams:

| Part | Lattice | Brackets |
| --- | --- | --- |
| Doors | 3 × 3 × 2 | upper hinge, lower hinge, latch |
| Hood | 3 × 5 × 2 | left hinge, right hinge, latch |
| Front fenders | 4 × 2 × 2 | front bolts, two top bolts, rear bolts at the door pillar |
| Tailgate | 3 × 2 × 2 | two hinges below, two latches above |
| Bumpers | 4 × 2 × 2 | four middle bolts and two end brackets |
| Headlights, grille, taillights | 2 × 2 × 2 box fitted to the part | left and right plastic clips at the face toward the cab |

The headlights, grille and taillights are small housings on plastic clips that let go early. A 50 km/h wall hit knocks the grille out. A harder or offset hit takes the headlights too, and a knocked-out headlight goes dark. A nose-first landing off a ramp at 70 km/h can knock off the front bumper or a headlight.

**The front bumper.** Its four middle bolts shear early, and the two end brackets are stronger and hold longest. In a straight hit the bumper is pushed in and stays on. In an offset or angled hit the bolts and the near end tear, and the bumper hangs from its far end with its other end on the ground. The rear bumper keeps even, stronger bolts. The tailgate swings on its hinges once its latches tear and comes off in a hard rear hit.

- **Bracket failure:** a bracket lets go as a unit after losing half its beams (a hood latch after its first). Failures stay local, so a door whose upper hinge and latch tear off swings and hangs on its lower hinge.
- **Load sharing:** each snapped beam concentrates stress in its bracket neighbours (mechanic 7). A moderate hit leaves a part hanging; a severe one tears it free as one panel.
- **Free parts:** a part with no brackets left moves into its own simulation context with exactly the momentum it had, keeps deforming, and goes to sleep once it comes to rest.

**Front fenders.** Each fender is a 4 × 2 × 2 lattice over the wheel arch, from the arch's crown to the hood line. It is bolted along its front, top and rear edges to the outer half of the structure on its own side.

- Its sheet is soft and crumples readily.
- Struts behind it, which only push, stand in for the inner apron. A crushed fender therefore folds out and back instead of in under the hood.
- The rear bolts at the door pillar hold longest.

The front and top bolts give early, so from about 50 km/h into the wall a fender folds back and hangs from its rear bolts, or rips off and falls by the wall, leaving the inner wheel arch exposed. At 100 km/h one or both come off. A torn-off fender keeps its dents but drops the accordion pleats, which follow the chassis' crumple zone.

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

Laterally and fore-aft the hub is held by a stiff link that bends plastically in crashes, up to 38 cm, so a hard frontal hit shoves a front wheel back into the door.

**Visible linkage.** The whole suspension moves, not just the wheels. Each frame the worker measures each front hub's travel relative to where it would sit fixed to the frame, and the rear axle's rigid pose.

- **Front (independent):** each vertex of an upper or lower arm, tie rod or half-shaft follows its wheel's travel in proportion to how far outboard it sits. The inner pivot stays on the frame and the knuckle end rides with the wheel. The coil-overs follow by height: the foot rides on the lower arm and the top stays at the tower. The tie rods also slide with the steering rack.
- **Rear (solid axle):** the axle housing follows the line between the rear hubs. Each leaf spring bows with it: its middle rides on the axle and its eyes stay on the hangers. The shocks stretch between the axle and the frame.

On the twist course the arms tilt, the springs compress and the leafs flex as the truck articulates.

**Tyres.**
- **Normal force:** the probe ring measures how far the tyre is compressed against the world, which gives the radial force.
- **Friction:** friction acts at a single contact patch per wheel. The patch deflects with the slip velocity and relaxes over a relaxation length while rolling. That gives slip-ratio and slip-angle forces at speed, and true static friction at a standstill: the truck holds still on the 10° ramp with the brake on.
- **Friction limit:** the force is capped by a Coulomb limit that falls from the static (peak) value to the kinetic one as slip grows, with load sensitivity. The peak, μ = 0.92 falling to 0.70 sliding, is an all-season light-truck tyre on dry concrete. Past the peak the grip eases off gently: about 94 % at 11° of slip angle and 88 % at 17°. Only a locked or spinning tyre falls to the sliding value, so a tyre pushed just past its limit recovers instead of letting go like ice.
- **Spin coupling:** wheel spin is coupled implicitly through the patch damping.
- **Moments:** the patch moment goes to the body with its full lever arm from the ground, so weight transfer under braking, acceleration and cornering comes out of the geometry.

**Drivetrain.** The Gavril D-Series is BeamNG's take on a full-size pickup like the Ford F-150, so the truck carries that class's V8 drivetrain:

| | |
| --- | --- |
| Engine | 5.0 L V8, about 245 hp at 4500 rpm, 425 N·m at 3500 rpm, from a torque curve table; rev limiter at 5600 rpm |
| Gearbox | 4-speed automatic (2.71, 1.54, 1.00, 0.71; reverse 2.18), 3.55 axle |
| Torque converter | multiplies torque (up to 1.6×) below its stall speed, which rises with throttle; locks up in 3rd and 4th |
| Shift schedule | later upshifts and earlier kickdowns the harder the throttle is pressed |
| 4WD | 40/60 front/rear torque split, a viscous centre coupling and viscous limited-slip axles: a full-throttle launch puts its torque down on all four tyres instead of spinning the rears |
| Brakes | four-channel ABS |
| Drag and rolling resistance | CdA 1.45 m², light-truck tyres at 0.015 |
| Speed limiter | 178 km/h, like a road truck's |

Measured on the bench: 0–100 km/h in 8.0 s (0–60 mph in 7.6 s), 178 km/h on the limiter, and 100–0 km/h braking in about 44 m. Steady cornering holds about 0.8 g with the body sideslip under 2°. Steering uses Ackermann geometry, with about 29° of lock at rest (a 12 m turning circle) and less at speed.

## Settings

The SETTINGS button (or G), or Options in the main menu, opens a panel with two choices. They are remembered in this browser.

**Deformation:**

| Setting | Free sheet metal | What changes | Cost in a crash |
| --- | --- | --- | --- |
| SIMPLIFIED | none | the panels ride the beam structure; it still crushes, folds and tears parts off, but there are no local dents | the cheapest, about 0.6× NORMAL |
| NORMAL (default) | up to 500 skin nodes at once | free sheet metal where the truck is hit, dents that set and spread | 1× |
| ENHANCED | up to 1100 skin nodes | dents form more easily (flexnode yield ×0.7) and spread further (share 0.5), pleats stand 25 % deeper, twice the normals budget | about 1.5× NORMAL |

**Time of day** is chosen in the main menu's Choose Level window (Play), one thumbnail per time:

| Time | Sky | Light |
| --- | --- | --- |
| Day | Pale blue | High sun |
| Evening | Orange horizon under a deep blue zenith | Low warm sun, long shadows; headlights and floodlights at half strength |
| Night | Dark, with stars | Dim blue moonlight; working headlight beams, glowing tail lights and five floodlight poles over the test area |

Each time sets the sky colours, the sun or moon direction, colour and strength, the hemisphere fill, the reflections (re-rendered from that sky), exposure, haze and bloom. At night the HUD text turns light on a dark halo.

The truck's lights switch on by themselves in the evening and at night. LIGHTS (or L) turns them on or off at any time; in daylight a switched-on beam runs at half strength.

**Graphics:**

| Preset | Resolution | Sun shadows | Anti-aliasing | Smoke / spark particles | Extras |
| --- | --- | --- | --- | --- | --- |
| LOW | ¾ | off | FXAA | 220 / 90 | no bloom, two floodlights |
| MEDIUM | 1× | 1024 px | FXAA | 600 / 220 | bloom |
| HIGH | up to 1.5× | 2048 px | 4× MSAA | 1200 / 450 | bloom |
| ULTRA | up to 2× | 4096 px | 8× MSAA | 2400 / 900 | bloom, headlight shadows |

Each preset also scales how densely the effects emit (0.4× on LOW up to 1.6× on ULTRA).

The default is HIGH on desktop and MEDIUM on touch devices.

## Rendering

- **Lighting:**
  - **Sun:** a directional light with cascaded shadow maps. The nearest cascade covers only about 11 m around the car, which gives sharp contact shadows under the chassis.
  - **Fill:** a hemisphere sky-bounce light, with image-based reflections from the sky. There is no flat ambient light.
  - **Post:** an HDR render goes through a light bloom and ACES tone mapping, then MSAA or FXAA depending on the graphics preset.
- **Grime:** the truck carries road dirt, computed in the shaders from each vertex's position on the undamaged model, so the pattern stays put on the metal however a panel bends or wherever a torn-off part lands.
  - Mud collects low on the body (rockers, bumpers, lower doors), with a ragged edge and short run-down streaks, and it sprays up and back from each wheel with flung specks.
  - Dust settles on faces that look up.
  - Mud makes paint matte and dulls chrome. The tyres go grey-brown and the wheels collect brake dust.
  - The truck starts with a light film of road dust and gets dirtier with distance, quite dirty after about 5 km, faster while its tyres spin. RESET VEHICLE washes it.
- **Materials:** physically based. Clearcoat coral-red paint with a working truck's sheen rather than a mirror finish, matte rough rubber, glass headlight lenses over emissive reflectors, a satin grille split out of the fascia, and chrome bumpers. The ground is the white gridmap with painted markings.
- **Skinning:** panel vertices ride on their four nearest same-side flexnodes, rotated with each flexnode's blended node rotation. The weights fade to zero at the fifth-nearest flexnode, so there are no seams. Each flexnode's map is affine (x → R·x + T), so a vertex needs one blended matrix: (Σ w·R)·v + Σ w·T.
- **Intact panels:** a panel moving as a rigid body skips skinning altogether. The worker fits one matrix to its flexnodes (their mean rotation and the shift of their centroid), and the page draws the panel's rest geometry under it, uploading no vertices. A panel stays skinned while it is pleated, while any of its flexnodes is awake or dented, or while a flexnode sits more than 7 mm off the fit (16 mm to leave). That covers bent structure, and the frame and doors flexing under hard braking and cornering. An intact truck is drawn almost entirely from matrices. Normals are recomputed once a panel is dented. The panels take turns under a budget of 20,000 triangles per frame, since a crash dents many at once; a panel waiting for its turn shows its rotated rest normals.
- **Accordion pleats:** a crushed bay can't shorten its sheet metal, so the fenders, wheel tubs and body sides ahead of the cowl fold into sharp pleats across it. The pleats are a triangle wave of 24 cm rest wavelength, standing (λ/4)·√(1 − r²) high (deepened 1.4× so they read clearly) for a bay squeezed to a fraction r of its length. Normals are recomputed, so the folds catch the light.
- **Torn metal:** triangles of a dented panel that stretch past 1.8× along an edge are removed from the mesh on both the worker and the page, so the panel opens up into strips.
- **Engine bay:** the engine, manifold, radiator, hoses and battery meshes aren't drawn at all for now. Under the hood they're never seen, and in a crash they only showed as black slabs. The physics keeps its engine and gearbox blocks. The front suspension and steering are hidden once the crumple zone shortens by 3 cm, so a crash never shows them as black shards through the panels.
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
| Dust | a little grit from tyres rolling fast or slipping and from metal scraping | low brown-grey puffs that settle quickly |
| Impact dust | a node slammed into the wall or the floor faster than 4 m/s; a big impact's dust is capped per batch | a billow of pale concrete dust spreading out from the contact and rising slowly |
| Debris | impacts, snapped beams and scraping metal | small dark chips of grit and plastic with flecks of paint, flung out, tumbling as they fly and bouncing on the floor; up to a third of the smoke budget |
| Radiator steam | the crumple zone crushed past 8 cm | coolant steam rising from the grille for half a minute, fading; after a very hard hit, puffs of dark smoke mixed in |
| Sparks | about 12 sparks per second per scraping node for each m/s of sliding, plus a burst per snapped beam | hot additive streaks stretched along their velocity, cooling from white through yellow to red; they fall, bounce off the ground and bloom |

Smoke, dust and steam are camera-facing billboards cut from a procedural puff atlas and sorted back to front. They take the time of day's sun and sky colour, with bright tops and shaded undersides, so they read as volumes in daylight and glow orange in the evening. Everything advances with simulation time, so slow motion slows the smoke too.

## Vehicle model and licence

`models/gavril_d/scene.glb` is "Gavril_D_ Beamng" by [akhikavi7](https://sketchfab.com/akhikavi7), from [Sketchfab](https://sketchfab.com/3d-models/gavril-d--beamng-16aa7bf3a00e4d4fb74edc52fda042f5), licensed CC-BY-4.0 (see `models/gavril_d/license.txt`). It was repacked losslessly from the original `.gltf` + `.bin` into a single GLB. The in-game HUD shows the same credit.
