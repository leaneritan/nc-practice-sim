import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useI18n } from '../i18n';
import type { Heightmap, CuttingTool } from '../nc/stock';
import { physicalTip, removedVolume, viseBoxes } from '../nc/stock';
import type { Vec3 } from '../nc';
import { stockVertices } from '../view/stockMesh';

export interface StockMarker extends Vec3 { kind: 'undercut' | 'overcut' | 'selected' }
const noMarkers: StockMarker[] = [];
export function StockView({ stock, position, origin, rotation = 0, tool, markers = noMarkers }: { stock: Heightmap; position: Vec3; origin: Vec3; rotation?: number; tool?: CuttingTool; markers?: StockMarker[] }) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ stock: THREE.Mesh; tool: THREE.Mesh; marks: THREE.Points; selected: THREE.Points; renderer: THREE.WebGLRenderer; reset: () => void } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      if (typeof WebGLRenderingContext === 'undefined') { setUnavailable(true); return; }
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch { setUnavailable(true); return; }
    const element = host.current;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e5ece6');
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 3000); camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    controls.minDistance = 50; controls.maxDistance = 1000;
    const reset = () => { camera.position.set(210, -230, 200); controls.target.set(50, 30, 0); controls.update(); };
    reset();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x466052, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(80, -80, 160); scene.add(light);
    const stockMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#a4b5b0', metalness: .35, roughness: .5, side: THREE.DoubleSide }));
    scene.add(stockMesh);
    for (const box of [...viseBoxes, { min: { x: -80, y: -60, z: -65 }, max: { x: 180, y: 120, z: -60 } }]) {
      const size = new THREE.Vector3(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color: '#596d70', roughness: .7 }));
      mesh.position.set((box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2, (box.max.z + box.min.z) / 2); scene.add(mesh);
    }
    const toolMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), new THREE.MeshStandardMaterial({ color: '#dca34a', metalness: .65, roughness: .3, transparent: true, opacity: .8 }));
    toolMesh.rotation.x = Math.PI / 2; scene.add(toolMesh);
    scene.add(new THREE.AxesHelper(35));
    const marks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 4, vertexColors: true, depthTest: false }));
    const selected = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 15, color: '#005dff', depthTest: false }));
    marks.renderOrder = 2; selected.renderOrder = 3; scene.add(marks, selected);
    sceneRef.current = { stock: stockMesh, tool: toolMesh, marks, selected, renderer, reset };
    const resize = () => { const width = Math.max(240, element.clientWidth); renderer.setSize(width, 380); camera.aspect = width / 380; camera.updateProjectionMatrix(); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(element);
    let frame = 0;
    const draw = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(draw); }; draw();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); sceneRef.current = null;
    };
  }, []);
  useEffect(() => {
    const meshes = sceneRef.current; if (!meshes) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(stockVertices(stock), 3)); geometry.computeVertexNormals();
    meshes.stock.geometry.dispose(); meshes.stock.geometry = geometry;
  }, [stock]);
  useEffect(() => {
    const meshes = sceneRef.current; if (!meshes) return;
    meshes.renderer.domElement.setAttribute('aria-label', t.sim.canvas);
    const tip = physicalTip(position, origin, tool, rotation);
    meshes.tool.visible = !!tool;
    if (tool) { meshes.tool.scale.set(tool.actual / 2, tool.length, tool.actual / 2); meshes.tool.position.set(tip.x, tip.y, tip.z + tool.length / 2); }
  }, [position, origin, rotation, tool, t.sim.canvas]);
  useEffect(() => {
    const meshes = sceneRef.current; if (!meshes) return;
    for (const [mesh, points] of [[meshes.marks, markers.filter(m => m.kind !== 'selected')], [meshes.selected, markers.filter(m => m.kind === 'selected')]] as const) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => [p.x, p.y, p.z]), 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(points.flatMap(p => new THREE.Color(p.kind === 'overcut' ? '#c52f38' : '#cf900a').toArray()), 3));
      mesh.geometry.dispose(); mesh.geometry = geometry;
    }
  }, [markers]);
  return <section className="stock-view" aria-label={t.sim.title}>
    <div className="result-heading"><h3>{t.sim.title}</h3><button onClick={() => sceneRef.current?.reset()}>{t.sim.resetCamera}</button></div>
    <div ref={host} className="stock-canvas" />
    {unavailable && <p>{t.sim.noWebgl}</p>}
    <p><strong>{t.sim.removed}: {removedVolume(stock).toFixed(1)} {t.sim.cubicMm}</strong></p>
    <p className="hint">{t.sim.viewHint}</p><p className="hint">{t.sim.modelHint}</p>
  </section>;
}
