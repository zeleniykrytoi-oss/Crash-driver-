# Crash Driver

A soft-body vehicle crash simulator in a single HTML file, styled after the 2013-era BeamNG.drive tech demos. A pickup truck is a 4500-node network of 708 constraint beams and 30 volume cells, solved with XPBD at a fixed 1 ms step (1000 Hz) in a dedicated Web Worker.

In a crash the crumple zone folds progressively and spreads sideways. The front piles up against a rigid engine block, the hood buckles, the suspension bends, and bumpers, hood and doors tear off when their brackets fail. The tyres use a contact-patch friction model with slip ratio, slip angle and static/kinetic friction, on coil-over suspension with asymmetric dampers and anti-roll bars.

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

**Spatial partitioning.** Static obstacles are indexed in a 4 m grid. Once per step, each simulated body gathers the obstacles its bounding box overlaps, usually none or one. Per-node collision queries test only that list, and never other nodes. Flexnode clusters only wake when their own bounding box nears the ground or an obstacle.

## The solver

**Step.** Each 1 ms step runs in four stages:

1. Explicit external forces predict new positions: gravity, coil-over suspension, tyres, drag.
2. One Gauss-Seidel pass of XPBD constraints projects them.
3. Velocities are the resulting position change.
4. Velocities are damped per beam.

XPBD is stable at any stiffness, so no beam is softened to fit the step: its compliance is exactly 1/k.

**Nodes.**
- **Structural nodes:** 11 chassis cross-section rings, closer together in the front crumple zone, plus two-layer lattices for each detachable part.
- **Rigid blocks:** 8 corner nodes each for the engine and the gearbox.
- **Hubs:** 4, one per wheel centre.
- **Tread probes:** 256, a fixed 2 × 32 ring per wheel.
- **Flexnodes:** 4066 surface samples of the panels, which fill the matrix to exactly 4500 nodes.

**Beams.** Each beam is a compliant distance constraint. The force it applies in a step is capped at its yield force, and whatever it can't carry flows into its rest length:
- **Compression:** past 5 % compression the rest length shortens permanently. A member that has buckled keeps only part of its strength, so one bay folds completely before the next starts, like an accordion. The front rails keep 35 %, like thin-walled crash rails.
- **Packed metal:** below 32 % of its length a beam stops flowing.
- **Tension:** past a smaller tension limit the rest length stretches.
- **Snapping:** beams snap past a strain limit. Mounting brackets also tear once their plastic budget is used up.

**Volume cells.** Every bay between two chassis rings is a closed hexagonal prism, and every part lattice cube is a hexahedron. The volume of each is a constraint with the exact closed-surface gradient. The generalised force is a pressure. Past the cell's yield pressure, the rest volume flows plastically between a floor and a ceiling.

When a bay is crushed lengthwise, the pressure pushes its side walls out against cross members that are deliberately weak in tension. The crushed nose therefore spreads by about 10 cm instead of collapsing into a clump. The cab's cells resist pressure about 2.5× more than the crumple zones'.

**Engine and gearbox.** Each is an undeformable lattice of zero-compliance beams: 12 edges, 6 face diagonals and 4 body diagonals, swept four times per step. They carry 230 kg and 95 kg on plastic mounts, and the gearbox bolts rigidly to the back of the engine.

Crumple-zone beams that are driven into a block are pushed back out of it. The front therefore has to fold up ahead of the engine, and only a hard enough hit shoves the engine back toward the firewall.

**Contacts.** Contacts are position-based. A node is projected out along the contact normal, then Coulomb friction acts on that step's tangential displacement: static while it is within μ times the normal correction, kinetic sliding beyond that. Only the penetration created by this step's own approach may turn into velocity. Anything deeper is eased out without launching the body.

**Flexnodes (the skin sheet).** Every flexnode follows a smooth blend of the 6 nearest structural nodes of its part (embedded deformation):

- **Node rotations:** each structural node carries its own rotation, shape-matched over itself and its beam neighbours.
- **Smooth weights:** the weights fade to zero at the next node out, so neighbouring flexnodes always blend almost the same nodes. However hard the structure is crushed, the skin moves as one continuous sheet and can't tear into shards.
- **Awake flexnodes:** each is a zero-length XPBD constraint to its sheet target, and its reaction goes back to the structural nodes it blends.
- **Bending:** each step, an awake flexnode's deviation from the sheet is pulled toward its neighbours' deviations. This is the discrete form of the sheet's bending stiffness, so a contact spreads over the panel instead of raising a spike.
- **Dents:** deviation past about 1 cm becomes a permanent rest-space offset. Surface neighbours within 24 cm take a smoothly falling share of it, so the patch sets together as one bowl or crease.
- **Sleeping:** flexnodes are kinematic and cost nothing until something touches them.

**Detaching parts.** Parts come from GLTF node names: Chassis, Front Bumper, Rear Bumper, Left Door, Right Door and Hood. Each hangs on named brackets of attachment beams:

| Part | Brackets |
| --- | --- |
| Doors | upper hinge, lower hinge, latch |
| Hood | left hinge, right hinge, latch |
| Bumpers | one per bolt |

- **Bracket failure:** a bracket lets go as a unit after losing half its beams (a hood latch after its first). Failures stay local, so a door whose upper hinge and latch tear off swings and hangs on its lower hinge.
- **Load sharing:** each failed bracket leaves the part's remaining brackets carrying its load, and their break limits drop. A moderate hit leaves a part hanging; a severe one tears it free as one panel.
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
- **Skinning:** panel vertices ride on their four nearest same-side flexnodes, rotated with each flexnode's blended node rotation. The weights fade to zero at the fifth-nearest flexnode, so there are no seams.
- **Buckles:** sheet metal can't shorten, so where the structure is squeezed along an axis, the skin takes up the slack in long (0.5 m), outward-standing buckles of height (λ/π)·√(1/r − 1). Normals are recomputed once a panel is dented or buckled.
- **Rigid parts:** the engine and gearbox meshes ride on their blocks. Radiator and suspension parts in the engine bay are skinned to the structure.
- **Wheels:** the stock GLTF wheels are measured and removed. The generated wheels (tyre, rim, instanced lug nuts, disc and caliper) spin, steer, and squash where the probes report compression.

## Vehicle model and licence

`models/gavril_d/scene.glb` is "Gavril_D_ Beamng" by [akhikavi7](https://sketchfab.com/akhikavi7), from [Sketchfab](https://sketchfab.com/3d-models/gavril-d--beamng-16aa7bf3a00e4d4fb74edc52fda042f5), licensed CC-BY-4.0 (see `models/gavril_d/license.txt`). It was repacked losslessly from the original `.gltf` + `.bin` into a single GLB. The in-game HUD shows the same credit.
