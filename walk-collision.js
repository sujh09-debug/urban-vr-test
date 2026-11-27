/* Urban Scale VR: static GLB collision for flat, fixed-height joystick walking.
 * Uses a 0.56 m wide body, triangle geometry and a spatial grid. No physics CDN.
 * Only controller locomotion is constrained; headset tracking remains physical.
 */
(function (global) {
  'use strict';

  const EPS = 1e-7;

  function pointSegment2(x,z,ax,az,bx,bz) {
    const dx=bx-ax, dz=bz-az, length=dx*dx+dz*dz;
    const t=length ? Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length)) : 0;
    return (x-ax-t*dx)**2+(z-az-t*dz)**2;
  }

  function segmentDistance2(ax,az,bx,bz,cx,cz,dx,dz) {
    const ux=bx-ax, uz=bz-az, vx=dx-cx, vz=dz-cz;
    const denominator=ux*vz-uz*vx;
    if(Math.abs(denominator)>1e-12) {
      const wx=cx-ax, wz=cz-az;
      const t=(wx*vz-wz*vx)/denominator;
      const u=(wx*uz-wz*ux)/denominator;
      if(t>=0 && t<=1 && u>=0 && u<=1) return 0;
    }
    return Math.min(
      pointSegment2(ax,az,cx,cz,dx,dz),pointSegment2(bx,bz,cx,cz,dx,dz),
      pointSegment2(cx,cz,ax,az,bx,bz),pointSegment2(dx,dz,ax,az,bx,bz)
    );
  }

  function signedDistance(x,z,shape) {
    const p=shape.points, n=p.length;
    let nearest=Infinity, positive=false, negative=false;
    for(let i=0;i<n;i++) {
      const a=p[i], b=p[(i+1)%n];
      nearest=Math.min(nearest,pointSegment2(x,z,a[0],a[1],b[0],b[1]));
      const cross=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);
      if(cross>EPS) positive=true;
      if(cross<-EPS) negative=true;
    }
    const distance=Math.sqrt(nearest);
    return n>2 && !(positive && negative) ? -distance : distance;
  }

  function sweptDistance2(ax,az,bx,bz,shape,oldDistance,newDistance) {
    if(oldDistance<0 || newDistance<0) return 0;
    let distance=Infinity;
    const p=shape.points;
    for(let i=0;i<p.length;i++) {
      const a=p[i], b=p[(i+1)%p.length];
      distance=Math.min(distance,segmentDistance2(ax,az,bx,bz,a[0],a[1],b[0],b[1]));
    }
    return distance;
  }

  function clipHeight(points,height,keepAbove) {
    const out=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i], b=points[(i+1)%points.length];
      const aIn=keepAbove ? a[1]>=height : a[1]<=height;
      const bIn=keepAbove ? b[1]>=height : b[1]<=height;
      if(aIn) out.push(a);
      if(aIn!==bIn) {
        const t=(height-a[1])/(b[1]-a[1]);
        out.push([a[0]+(b[0]-a[0])*t,height,a[2]+(b[2]-a[2])*t]);
      }
    }
    return out;
  }

  class CollisionWorld {
    constructor(options={}) {
      this.radius=options.radius ?? .28;
      this.floorY=options.floorY ?? 0;
      this.footClearance=options.footClearance ?? .18;
      this.height=options.height ?? 1.7;
      this.cellSize=options.cellSize ?? 2;
      this.cells=new Map();
      this.large=[];
      this.shapes=[];
      this.queryId=0;
      this.candidates=[];
    }

    addTriangle(a,b,c) {
      const low=this.floorY+this.footClearance, high=this.floorY+this.height;
      if(Math.max(a[1],b[1],c[1])<=low || Math.min(a[1],b[1],c[1])>=high) return;
      let polygon=clipHeight(clipHeight([a,b,c],low,true),high,false);
      if(polygon.length<2) return;
      let points=[];
      for(const vertex of polygon) {
        const point=[vertex[0],vertex[2]];
        if(!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
        if(!points.some(p=>(p[0]-point[0])**2+(p[1]-point[1])**2<1e-12)) points.push(point);
      }
      if(points.length<2) return;
      let area=0;
      for(let i=0;i<points.length;i++) {
        const p=points[i], q=points[(i+1)%points.length];
        area+=p[0]*q[1]-q[0]*p[1];
      }
      // A vertical wall projects to a segment. Retain its longest endpoints.
      if(Math.abs(area)<1e-8 && points.length>2) {
        let farthest=0, ends=null;
        for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
          const distance=(points[i][0]-points[j][0])**2+(points[i][1]-points[j][1])**2;
          if(distance>farthest) { farthest=distance; ends=[points[i],points[j]]; }
        }
        if(!ends || farthest<1e-12) return;
        points=ends;
      }
      const shape={points,mark:0,minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};
      for(const p of points) {
        shape.minX=Math.min(shape.minX,p[0]); shape.maxX=Math.max(shape.maxX,p[0]);
        shape.minZ=Math.min(shape.minZ,p[1]); shape.maxZ=Math.max(shape.maxZ,p[1]);
      }
      this.shapes.push(shape);
      const x0=Math.floor(shape.minX/this.cellSize), x1=Math.floor(shape.maxX/this.cellSize);
      const z0=Math.floor(shape.minZ/this.cellSize), z1=Math.floor(shape.maxZ/this.cellSize);
      if((x1-x0+1)*(z1-z0+1)>4096) { this.large.push(shape); return; }
      for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++) {
        const key=x+','+z;
        if(!this.cells.has(key)) this.cells.set(key,[]);
        this.cells.get(key).push(shape);
      }
    }

    query(ax,az,bx,bz) {
      const radius=this.radius, size=this.cellSize, id=++this.queryId;
      const minX=Math.min(ax,bx)-radius, maxX=Math.max(ax,bx)+radius;
      const minZ=Math.min(az,bz)-radius, maxZ=Math.max(az,bz)+radius;
      const list=this.candidates;
      list.length=0;
      const append=shape=>{
        if(shape.mark===id) return;
        shape.mark=id;
        if(shape.maxX<minX || shape.minX>maxX || shape.maxZ<minZ || shape.minZ>maxZ) return;
        list.push(shape);
      };
      for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++) {
        for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++) {
          const cell=this.cells.get(x+','+z);
          if(cell) for(const shape of cell) append(shape);
        }
      }
      for(const shape of this.large) append(shape);
      return list;
    }

    canMove(ax,az,bx,bz) {
      const radius=this.radius;
      for(const shape of this.query(ax,az,bx,bz)) {
        const before=signedDistance(ax,az,shape);
        const after=signedDistance(bx,bz,shape);
        const path=sweptDistance2(ax,az,bx,bz,shape,before,after);
        if(before<radius-EPS) {
          // A preset may start close to a wall. Permit retreat and tangential
          // movement, but never move deeper into it or cross a thin wall.
          if(after<before-EPS) return false;
          if(before>EPS && path<(before-EPS)**2) return false;
        } else if(path<(radius-EPS)**2) return false;
      }
      return true;
    }

    move(x,z,dx,dz) {
      if(![x,z,dx,dz].every(Number.isFinite)) return {x,z};
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.min(.08,this.radius*.3)));
      const sx=dx/steps, sz=dz/steps;
      for(let i=0;i<steps;i++) {
        if(this.canMove(x,z,x+sx,z+sz)) { x+=sx; z+=sz; }
        else {
          if(Math.abs(sx)>1e-12 && this.canMove(x,z,x+sx,z)) x+=sx;
          if(Math.abs(sz)>1e-12 && this.canMove(x,z,x,z+sz)) z+=sz;
        }
      }
      return {x,z};
    }

    async fromObject(root,cancelled=()=>false) {
      root.updateWorldMatrix(true,true);
      const meshes=[];
      root.traverseVisible(mesh=>{
        if(!mesh.isMesh || !mesh.geometry?.attributes.position) return;
        const descriptor=matrix=>meshes.push({geometry:mesh.geometry,matrix});
        if(mesh.isInstancedMesh) {
          const THREE=global.AFRAME.THREE;
          const local=new THREE.Matrix4(), world=new THREE.Matrix4();
          for(let i=0;i<mesh.count;i++) {
            mesh.getMatrixAt(i,local);
            descriptor(world.multiplyMatrices(mesh.matrixWorld,local).elements.slice());
          }
        } else descriptor(mesh.matrixWorld.elements.slice());
      });
      let batch=0;
      for(const {geometry,matrix:m} of meshes) {
        const p=geometry.attributes.position, indices=geometry.index;
        const count=indices ? indices.count : p.count;
        const start=geometry.drawRange?.start || 0;
        const end=Math.min(count,start+(geometry.drawRange?.count ?? Infinity));
        const vertex=i=>{
          const j=indices ? indices.getX(i) : i;
          const x=p.getX(j), y=p.getY(j), z=p.getZ(j);
          return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
        };
        for(let i=start;i+2<end;i+=3) {
          this.addTriangle(vertex(i),vertex(i+1),vertex(i+2));
          if(++batch===6000) {
            batch=0;
            await new Promise(resolve=>setTimeout(resolve,0));
            if(cancelled()) return false;
          }
        }
      }
      return !cancelled();
    }
  }

  global.URBAN_VR_COLLISION={CollisionWorld};

  global.AFRAME.registerComponent('quest-free-walk',{
    schema:{
      speed:{type:'number',default:2},
      deadzone:{type:'number',default:.2},
      radius:{type:'number',default:.28},
      footClearance:{type:'number',default:.18},
      height:{type:'number',default:1.7}
    },

    init:function(){
      const THREE=global.AFRAME.THREE;
      this.forward=new THREE.Vector3(0,0,-1);
      this.heading=new THREE.Vector3(0,0,-1);
      this.right=new THREE.Vector3(1,0,0);
      this.up=new THREE.Vector3(0,1,0);
      this.headPosition=new THREE.Vector3();
      this.generation=0;
      this.world=null;
      this.ready=false;
    },

    clearEnvironment:function(){
      this.generation++;
      this.ready=false;
      this.world=null;
    },

    setEnvironment:async function(root){
      this.clearEnvironment();
      const generation=this.generation;
      const world=new CollisionWorld({
        radius:Math.max(.05,this.data.radius),
        footClearance:this.data.footClearance,
        height:this.data.height,
        floorY:this.el.object3D.position.y
      });
      const built=await world.fromObject(root,()=>this.generation!==generation);
      if(!built || this.generation!==generation) return false;
      this.world=world;
      this.ready=true;
      return true;
    },

    remove:function(){ this.clearEnvironment(); },

    tick:function(time,timeDelta){
      const scene=this.el.sceneEl;
      if(!this.ready || !this.world || !scene.is('vr-mode') || document.hidden) return;
      const session=scene.renderer?.xr?.getSession();
      if(!session || !scene.camera || !Number.isFinite(timeDelta) || timeDelta<=0) return;
      if(session.visibilityState && session.visibilityState!=='visible') return;
      let pad=null;
      for(const source of session.inputSources) {
        if(source.handedness==='left' && source.gamepad) { pad=source.gamepad; break; }
      }
      if(!pad || pad.connected===false || pad.axes.length<2) return;
      const offset=pad.axes.length>=4 ? 2 : 0;
      const x=pad.axes[offset], y=pad.axes[offset+1];
      if(!Number.isFinite(x) || !Number.isFinite(y)) return;
      const magnitude=Math.hypot(x,y);
      const deadzone=Math.max(0,Math.min(.95,this.data.deadzone));
      if(magnitude<=deadzone) return;
      scene.camera.getWorldDirection(this.heading);
      this.heading.y=0;
      if(this.heading.lengthSq()>.0001) this.forward.copy(this.heading).normalize();
      this.right.crossVectors(this.forward,this.up).normalize();
      const strength=(Math.min(magnitude,1)-deadzone)/(1-deadzone);
      const distance=Math.max(0,this.data.speed)*strength*Math.min(timeDelta,100)/1000;
      const dx=(this.forward.x*-y+this.right.x*x)/magnitude*distance;
      const dz=(this.forward.z*-y+this.right.z*x)/magnitude*distance;
      scene.camera.getWorldPosition(this.headPosition);
      const head=this.headPosition;
      const target=this.world.move(head.x,head.z,dx,dz);
      this.el.object3D.position.x+=target.x-head.x;
      this.el.object3D.position.z+=target.z-head.z;
    }
  });
})(window);
