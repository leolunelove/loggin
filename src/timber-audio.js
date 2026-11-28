// Short wood resonances driven by a rack impact or the stick-slip of a turning axle.
export function timberSamples(rate, creak, random=Math.random) {
  const duration=creak?.32:.43, data=new Float32Array(Math.ceil(duration*rate));
  const modes=(creak?[[312,28,.50],[705,44,.28],[1120,62,.12]]:[[116,22,.58],[257,30,.42],[603,57,.22]]).map(([hz,decay,gain])=>{
    const r=Math.exp(-decay/rate);
    return {a:2*r*Math.cos(2*Math.PI*hz/rate),b:r*r,gain:gain*Math.sin(2*Math.PI*hz/rate),y:0,z:0};
  });
  let next=0,peak=0,taps=0, pulse=0;
  for(let i=0;i<data.length;i++){
    const t=i/rate;
    if(t>=next){
      if(creak){pulse=Math.sin(Math.PI*t/duration)**.8;next=t+.004+.008*(t/duration)+.002*random();}
      else{pulse=[1,.47,.18][taps++]||0;next=[.076,.15,Infinity][taps-1];}
    }
    const excitation=pulse*(1.3*random()-.40);
    pulse*=Math.exp(-1/(rate*(creak?.0009:.0018)));
    let v=.08*excitation;
    for(const m of modes){const y=m.a*m.y-m.b*m.z+excitation*m.gain;m.z=m.y;m.y=y;v+=y;}
    v*=Math.min(1,(duration-t)*85);data[i]=v;peak=Math.max(peak,Math.abs(v));
  }
  const scale=(creak?.46:.79)/Math.max(.001,peak);
  for(let i=0;i<data.length;i++)data[i]*=scale;
  return data;
}

export function furnishingSamples(rate,kind,random=Math.random){
  const paper=kind==='page',linen=kind==='quilt',duration=paper?.39:linen?.55:.74;
  const data=new Float32Array(Math.round(rate*duration));
  let high=0,body=0,grain=0,next=0,ripple=0;
  for(let i=0;i<data.length;i++){
    const t=i/rate,p=t/duration,noise=2*random()-1;
    body+=.15*(noise-body);high+=.62*(noise-high);
    if(t>=next){grain=.62+random()*.38;next=t+.010+.018*random();}
    ripple+=grain*(paper?.012:.007);
    const pressure=paper?.76*Math.exp(-((p-.24)**2)/.012)+.45*Math.exp(-((p-.61)**2)/.014):Math.sin(Math.PI*p)**.82;
    const fibre=paper?high-body:linen?.90*body+.06*(high-body):.96*body+.24*(high-body);
    data[i]=fibre*pressure*grain*(.83+.17*Math.sin(ripple));
  }
  return data;
}
