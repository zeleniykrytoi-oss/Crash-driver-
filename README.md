# Crash Driver

A soft-body vehicle crash sandbox in a single HTML file, styled after the 2013-era BeamNG.drive tech demos. A pickup truck is simulated as a 4500-node / 644-beam mass-spring network stepped at a fixed 1 ms (1000 Hz). Its crumple zone folds progressively like an accordion, the hood buckles upward, the suspension bends, and bumpers, hood and doors tear off when their mounting brackets fail.

## Run it

The page is plain HTML plus ES modules from jsDelivr (three.js r160), so any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

`index.html` is self-contained. When it can fetch `models/gavril_d/scene.glb` it uses that truck. When it can't (for example when opened from `file://`), it builds a procedural placeholder pickup with the same part names and runs the same pipeline. Load another model with `?model=path/to/vehicle.glb` (`.gltf` works too).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | W / ↑ | THROTTLE paddle |
| Brake, hold at a stop to reverse | S / ↓ | BRAKE paddle |
| Steer | A D / ← → | ◀ ▶ buttons |
| Reset vehicle | R | RESET VEHICLE |
| Cycle camera (chase, orbit, trackside) | C | CAM |
| f-node debug view | N | F-NODES |
| Slow motion, 20× slower (×0.05), still whole 1 ms steps | T | SLOW-MO |
| Orbit camera | drag on the view | drag on the view |

The test bench has a concrete wall 45 m straight ahead of the spawn, a 10° ramp on the left lane and a 22° ramp on the right lane.

## How the engine works

Everything lives in `index.html`, split into numbered sections.

**Fixed step.** Each frame adds real time (times the slow-motion factor) to an accumulator and runs whole 1 ms steps, at most 50 per frame. A slow device gets slow motion instead of a bigger step. Slow-mo (×0.05) only runs fewer steps per frame, so the solver behaves identically and you can watch beams snap almost frame by frame; in the f-node view a snapped beam stays drawn in red for 0.4 s of sim time. The HUD shows the step size and the measured sim rate.

**Nodes** are point masses held in flat `Float64Array`s, integrated with symplectic Euler. There are four kinds:

- **Structural nodes (158):** 11 chassis cross-section rings (spaced 0.30 m in the front crumple zone, about 0.6 m elsewhere), plus two-layer lattices for each detachable part.
- **Hub nodes (4):** one per wheel centre.
- **Tread probes (256):** a fixed radial ring of 2 × 32 probes per wheel, used to measure tyre compression.
- **Flexnodes (4082):** sampled over each part's panels, area-weighted and evenly spaced, each with its surface normal. This fills the matrix to exactly 4500 nodes.

**Beams** (≤ 750) use Hooke's law with linear damping.

- **Compression:** once a beam is compressed past 5 %, its rest length shortens permanently. A member that has buckled keeps only part of its strength (softening), so one bay of the crumple zone folds completely before the next starts: an accordion. Below 32 % of its length a beam counts as packed metal and stops flowing, so a crushed nose keeps its volume instead of collapsing into a flat lump.
- **Tension:** past a smaller limit the rest length stretches plastically.
- **Snapping:** beams snap past a tension or compression strain measured from the factory length. Mounting brackets also tear once their accumulated plastic deformation is used up, so part loss grows with crash severity.
- **Hood:** its underside chords yield first, so a hood pushed back from the front tents upward instead of folding into the engine bay.
- **Stability:** a Gershgorin bound scales each beam's stiffness and damping so that every node stays stable at 1 ms.

**Flex constraints** bind each flexnode to a tetrahedron of its own part's structural nodes through affine (barycentric) weights. The constraint is a spring-damper to that affine target. Its reaction goes back to the four anchors with the same weights, so momentum and angular momentum are conserved.

- **Dents:** beyond about 1 cm of deviation the flexnode is re-anchored in its deformed tetrahedron, which is a permanent dent. Its four surface neighbours take 40 % of the push, so dents are smooth bowls rather than spikes.
- **Shape-matching frames:** each 0.55 m cluster of flexnodes owns a frame that finds the best-fit rotation of its anchor nodes every frame (Müller et al. 2016, never a reflection). A flexnode's target is kept within 15 cm of the frame's estimate of its dented rest position, so a crushed or inverted tetrahedron can't fling the skin around.
- **Sleeping:** flexnodes stay kinematic, costing nothing, until a cluster broadphase sees their region approach the ground, the wall or a ramp. They go back to sleep once they settle.

**Sub-groups.** The truck is partitioned into Chassis, Front Bumper, Rear Bumper, Left Door, Right Door and Hood, using GLTF node names (`hood`, `door_l`, `door_r`, `bumper_f`, `bumper_r`). Each part attaches to the chassis through inter-group beams arranged in brackets (break groups): left/right for the bumpers, left hinge / right hinge / latch for the hood, and hinge / latch for the doors. When enough beams in a bracket snap, the whole bracket fails. When every attachment beam of a part has failed, the part moves into its own simulation context. It keeps deforming and bouncing on its own, and goes to sleep once it comes to rest.

**Wheels.** On load, the stock GLTF wheels, brake discs and hubs are measured and then removed. Each wheel is replaced by:

- **A hub node** on an anisotropic suspension anchor: soft and preloaded along the chassis "up" direction, with progressive bump and droop stops, and stiff laterally. The lateral stiffness yields plastically in crashes, so the suspension bends.
- **A tread-probe ring** that measures tyre compression against the world.
- **A spin state:** angular velocity from drive, brake and tyre torques, with friction coupled implicitly so a stiff tyre can't destabilise the step.

The generated wheel mesh (tyre, steel rim, disc and caliper) rotates by the integrated wheel angle, steers with Ackermann geometry, and squashes radially wherever the probes report compression.

**Rendering.**

- **Skinning:** panel vertices are skinned on the CPU to their four nearest flexnodes on the same side of the panel (normals must agree), rotated by the shape-matching frames.
- **Folds:** where a frame has been permanently squeezed, the skin gets accordion pleats across the most compressed axis. Their depth follows the crush, roughly (λ/4)·√(1 − r²), so a light crush ripples and a flattened nose pleats deeply.
- **Normals:** recomputed once a panel is dented or folded, each face oriented against the skinned normal so double-sided panels don't go black.
- **Mechanical parts:** engine-bay parts (engine, radiator, front suspension) are skinned to the structure so a crushed bay pushes them back. Interior parts follow shape-matching frames, and the rear axle follows the line between the rear hubs.
- **Materials:** glossy two-coat sand paint, glass headlight lenses over emissive reflectors, a satin metal grille split out of the fascia, a dark radiator with a micro-grid texture, and chrome bumpers.
- **Lighting:** clean daylight, with a grey checker gridmap, a pale sky, neutral distance haze and a slightly warm sun. An HDR render goes through a light bloom and ACES tone mapping, then a pass that adds a few percent of warm balance and a soft vignette.

## Vehicle model and licence

`models/gavril_d/scene.glb` is "Gavril_D_ Beamng" by [akhikavi7](https://sketchfab.com/akhikavi7), from [Sketchfab](https://sketchfab.com/3d-models/gavril-d--beamng-16aa7bf3a00e4d4fb74edc52fda042f5), licensed CC-BY-4.0 (see `models/gavril_d/license.txt`), repacked losslessly from the original `.gltf` + `.bin` into a single GLB. The in-game HUD shows the same credit.
