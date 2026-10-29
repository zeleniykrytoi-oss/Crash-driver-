# Crash Driver

A soft-body vehicle crash simulator in a single HTML file, styled after the 2013-era BeamNG.drive tech demos. The pickup truck is a 4500-node network solved with XPBD at a fixed 1 ms step (1000 Hz) in a dedicated Web Worker:

- 726 constraint beams;
- 30 volume cells;
- a sheet-metal skin of 5789 stretch edges and 3686 dihedral bending hinges.

In a crash the crumple zone folds progressively and bulges sideways. The front piles up against a rigid engine block, and the hood folds into wide creases and arches up. A corner hit twists the frame. Bumpers, hood and doors hang from their hinges or tear off when their brackets fail.

The tyres use a contact-patch friction model with slip ratio, slip angle and static/kinetic friction, on coil-over suspension with asymmetric dampers and anti-roll bars.

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

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | W / ↑ | THROTTLE paddle |
| Brake (ABS); hold at a stop to reverse | S / ↓ | BRAKE paddle |
| Steer | A D / ← → | ◀ ▶ buttons |
| Reset vehicle | R | RESET VEHICLE |
| Cycle camera (chase, orbit, trackside) | C | CAM |
| f-node debug view | N | F-NODES |
| Slow motion: 20× slower (×0.05), still whole 1 ms steps | T | SLOW-MO |
| Orbit camera | drag on the view | drag on the view |

The test bench has a concrete wall 45 m straight ahead of the spawn, a 10° ramp on the left lane and a 22° ramp on the right lane.

The HUD shows:
- the solver load (step time plus skinning time per frame, on the worker);
- each tyre's share of the total load, so weight transfer is visible, with a tyre turning red while it slides;
- the body's lateral and longitudinal acceleration.

## Architecture

`index.html` has seven numbered sections. Section 1, `physicsLib()`, holds the whole simulation: solver, vehicle builder, drivetrain and skinning. It is one self-contained function with no DOM or three.js references.

**Worker thread.** Section 2 turns `physicsLib`'s source text into a Blob and starts a Web Worker from it. The main thread sends the model geometry once. After that, each frame it sends only the number of 1 ms steps that are due and the driver input. The worker then:

1. runs the steps, at most 60 per frame (a slow device gets slow motion, never a larger step);
2. skins the vehicle;
3. writes everything into one pooled `Float32Array` and transfers it back.

That buffer holds stats, node positions, beam states, wheel matrices and probe depths, skinned vertex positions and normals, and rigid-part matrices. The page points the meshes' `BufferAttribute.array`s straight into it and returns the previous buffer to the pool. Vertex data is never copied or allocated per frame.

**Spatial partitioning.** Static obstacles are indexed in a 4 m grid. Once per step, each simulated body gathers the obstacles its bounding box overlaps, usually none or one. Per-node collision queries test only that list, and never other nodes. Flexnode clusters only wake when their own bounding box nears the ground or an obstacle, or when the structure under them is crumpling.

## The solver

**Step.** Each 1 ms step runs in five stages:

1. Explicit external forces predict new positions: gravity, coil-over suspension, tyres, drag, and the air load on the hood and doors.
2. Beams are projected in one Jacobi sweep.
3. Gauss-Seidel passes project the volume cells, the rigid blocks, the skin sheet and the contacts.
4. Velocities are the resulting position change.
5. Velocities are damped per beam, with friction locking in crushed members.

XPBD is stable at any stiffness, so no beam is softened to fit the step: its compliance is exactly 1/k.

**Nodes.**
- **Structural nodes:** 11 chassis cross-section rings, closer together in the front crumple zone, plus two-layer lattices for each detachable part.
- **Rigid blocks:** 8 corner nodes each for the engine and the gearbox.
- **Hubs:** 4, one per wheel centre.
- **Tread probes:** 256, a fixed 2 × 32 ring per wheel.
- **Flexnodes:** 4066 surface samples of the panels, which fill the matrix to exactly 4500 nodes.

**Beams.** Each beam is a compliant distance constraint. The force it applies in a step is capped at its yield force, and whatever it can't carry flows into its rest length (see the mechanics below):
- **Compression:** past 5 % compression the rest length shortens permanently, like an accordion.
- **Packed metal:** below 32 % of its length a beam stops flowing.
- **Tension:** past a smaller tension limit the rest length stretches.
- **Snapping:** beams snap past a strain limit. Mounting brackets also tear once their plastic budget is used up.

**Volume cells.** Every bay between two chassis rings is a closed hexagonal prism, and every part lattice cube is a hexahedron. The volume of each is a constraint with the exact closed-surface gradient. The generalised force is a pressure. Past the cell's yield pressure, the rest volume flows plastically between a floor and a ceiling. Below the floor it densifies: its yield pressure climbs steeply, but it keeps flowing rather than storing the crush as a spring.

**Engine and gearbox.** Each is an undeformable lattice of zero-compliance beams: 12 edges, 6 face diagonals and 4 body diagonals, swept four times per step. They carry 230 kg and 95 kg on plastic mounts, and the gearbox bolts rigidly to the back of the engine.

Crumple-zone beams that are driven into a block are pushed back out of it. The front therefore has to fold up ahead of the engine, and only a hard enough hit shoves the engine back toward the firewall.

**Contacts.** Contacts are position-based. A node is projected out along the contact normal, then Coulomb friction acts on that step's tangential displacement: static while it is within μ times the normal correction, kinetic sliding beyond that. Only the penetration created by this step's own approach may turn into velocity, and only that fresh penetration sets the friction limit. Anything deeper is eased out without launching the body or gluing it to a wall.

**Flexnodes (the skin sheet).** Every flexnode follows a smooth blend of the 6 nearest structural nodes of its part (embedded deformation):

- **Node rotations:** each structural node carries its own rotation, shape-matched over itself and its beam neighbours.
- **Smooth weights:** the weights fade to zero at the next node out, so neighbouring flexnodes always blend almost the same nodes.
- **Awake flexnodes:** each is an XPBD constraint to its sheet target, and its reaction goes back to the structural nodes it blends. The tie is firm within the surface but only 12 % as stiff along the surface normal, so the sheet constraints can buckle a squeezed panel out of its plane.
- **Sheet mesh:** the panel meshes are clustered into a coarse triangle mesh over the flexnodes. Each of its edges is a stretch constraint, which yields plastically and tears past 60 % stretch. Each edge shared by two triangles is a dihedral bending constraint (mechanic 1 below).
- **Dents:** deviation past about 1 cm becomes a permanent rest-space offset. Sleeping surface neighbours within 24 cm take a smoothly falling share of it, so the patch sets together as one bowl or crease.
- **Sleeping:** a flexnode that has settled, or has been awake for 200 steps, bakes its dent and goes back to sleep. Sleeping flexnodes are kinematic and cost nothing. At most 1000 flexnodes are woken by crumpling at once; contacts always wake them.

## Metal deformation mechanics

Ten mechanics run inside the XPBD/flexnode loop on top of the beams, cells and sheet above. The constants live in `VEHICLE` and can be changed with `?tune=`.

1. **Dihedral bending constraints.** Every pair of adjacent sheet triangles carries a bending constraint on the angle between their faces, using Bridson's exact dihedral gradient (`dihedral()`, `solveSheet()`). Its stiffness is `sheet.kBend`. A contact therefore spreads into one wide, continuous fold across the hood and fenders instead of a field of spikes. Past `sheet.bendYield` (0.3 rad) the fold angle sets plastically, which forms a permanent crease.
2. **Logarithmic work hardening.** Each beam accumulates plastic strain ε<sub>p</sub>. Its yield force grows as F<sub>y</sub> = F<sub>y0</sub>·(1 + H·ln(1 + ε<sub>p</sub>/ε<sub>0</sub>)) (`plastic.H`, `plastic.eps0`), and its stiffness by the square of that factor. Crushed metal gets stronger and springs back less, so the crush moves on into the next undeformed bay rather than folding one bay flat.
3. **Stress-induced volume expansion.** While a cell is flowing plastically in compression, its volume push loses the component along its most shortened axis (`squeezeAxis()`). It therefore pushes only sideways: fenders bulge and the hood arches up into its fold, instead of stiffening against the crush. Elastic cells keep the exact (energy-conserving) gradient, so the structure can't pump energy into itself as it rings after an impact.
4. **Delayed impulse shockwave.** Beams are solved in one Jacobi sweep per step (`solveBeamsJacobi()`): every beam's correction is computed from the positions at the start of the sweep, and the corrections are summed per node. An impulse therefore crosses one beam per 1 ms step and runs from the bumper back to the cab as a wave, visible frame by frame in slow motion. Each beam's correction is scaled by the smaller of its two nodes' stable step sizes, recomputed every step from the hardened stiffnesses. That keeps the sweep stable and momentum-conserving.
5. **Non-linear plastic flow (viscoplasticity).** The plastic flow rate follows Cowper-Symonds, rate = D·(F/F<sub>y</sub> − 1)<sup>q</sup> (`plastic.D`, `plastic.q`), solved per beam by bisection (`flow()`). In the peak milliseconds of a crash a member carries more than its static yield and flows like heavy, viscous metal rather than snapping instantly to the yield force.
6. **Hinged hood flapping.** The hood's latch bracket lets go after its first beam fails, while its two rear hinge brackets keep holding. Each hood and door panel carries flat-plate aerodynamic pressure (`aeroParts()`, `air.Cn`). With the inertia of its lattice, that lifts an unlatched hood: it flaps, slams, and pivots on its rear hinges.
7. **Edge-tearing propagation.** When an attachment beam snaps, every unbroken attachment beam next to it along the panel edge has its tensile stress doubled, capped at 4× (`concentrate()`). Its neighbours are the beams on the same panel node or one lattice beam away. A torn corner therefore unzips along the seam, and a bracket that has lost half its beams fails as a unit.
8. **Frictional plastic damping.** A beam whose rest length has changed by more than 10 % of its factory length (`plastic.lockStrain`) gets Coulomb friction between its two nodes: up to `plastic.lockSpeed` (0.04 m/s) of their relative velocity is removed per step (`dampBeams()`). Crushed metal locks into shape instead of wobbling like jelly once the crash is over.
9. **Stretch-limit thinning.** Plastic stretch thins the metal: a beam's breaking strain shrinks to max(`thinMin`, 1 − `thin`·ε<sub>stretch</sub>) of its original value. Sheet edges tear the same way. Panel triangles stretched past 1.8× are cut out of the rendered mesh, so overstretched metal splits into strips.
10. **Shear twist diagonals.** Stiff diagonal cross-beams (`frameX`) brace the left and right rails, each spanning two chassis bays. A corner impact therefore twists the whole frame, cab and bed instead of folding one rail on its own.

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
- **Friction limit:** the force is capped by a Coulomb limit that falls from the static (peak) value to the kinetic one as slip grows, with load sensitivity.
- **Spin coupling:** wheel spin is coupled implicitly through the patch damping.
- **Moments:** the patch moment goes to the body with its full lever arm from the ground, so weight transfer under braking, acceleration and cornering comes out of the geometry.

**Drivetrain.** A 5-speed automatic with a torque converter, 4WD with viscous limited-slip axles, and four-channel ABS. Steering uses Ackermann geometry, with less lock at speed.

## Rendering

- **Lighting:**
  - **Sun:** a directional light with cascaded shadow maps. The nearest cascade covers only about 11 m around the car, which gives sharp contact shadows under the chassis.
  - **Fill:** a hemisphere sky-bounce light, with image-based reflections from the sky. There is no flat ambient light.
  - **Post:** an HDR render goes through a light bloom and ACES tone mapping. Desktop renders with 4× MSAA; touch devices use FXAA.
- **Materials:** physically based. Clearcoat sand paint, matte rough rubber, glass headlight lenses over emissive reflectors, a satin grille split out of the fascia, a dark radiator with a micro-grid texture, and chrome bumpers. The ground is a clean grey checker gridmap.
- **Skinning:** panel vertices ride on their four nearest same-side flexnodes, rotated with each flexnode's blended node rotation. The weights fade to zero at the fifth-nearest flexnode, so there are no seams. Normals are recomputed once a panel is dented.
- **Torn metal:** triangles of a dented panel that stretch past 1.8× along an edge are removed from the mesh on both the worker and the page, so the panel opens up into strips.
- **Rigid parts:** the engine and gearbox meshes ride on their blocks. Radiator and suspension parts in the engine bay are skinned to the structure.
- **Wheels:** the stock GLTF wheels are measured and removed. The generated wheels (tyre, rim, instanced lug nuts, disc and caliper) spin, steer, and squash where the probes report compression.

## Vehicle model and licence

`models/gavril_d/scene.glb` is "Gavril_D_ Beamng" by [akhikavi7](https://sketchfab.com/akhikavi7), from [Sketchfab](https://sketchfab.com/3d-models/gavril-d--beamng-16aa7bf3a00e4d4fb74edc52fda042f5), licensed CC-BY-4.0 (see `models/gavril_d/license.txt`). It was repacked losslessly from the original `.gltf` + `.bin` into a single GLB. The in-game HUD shows the same credit.
