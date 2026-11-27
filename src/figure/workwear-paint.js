// Pigment is laid out in the garment's rest pose. It follows the cloth through a swing.
export const GROOM = /* glsl */ `
#ifdef SKIN
uniform float uBeard;
uniform vec3 uWhisker;
float whiskerMask(vec3 p) {
  float side=abs(p.x),front=smoothstep(-.044,.025,p.z);
  float jaw=1.647+.061*smoothstep(.022,.077,side);
  float lower=smoothstep(1.589,1.614,p.y);
  float cheeks=1.-smoothstep(jaw-.009,jaw+.005,p.y);
  float lip=1.-smoothstep(.63,1.,length(vec2(p.x/.028,(p.y-1.661)/.009)));
  float u=side/.035;
  float wing=1.676-.011*smoothstep(.15,1.,u);
  float moustache=(1.-smoothstep(.58,1.,abs(p.y-wing)/(.004+.003*(1.-min(u,1.)))))
    *(1.-smoothstep(.78,1.,u))*(.61+.39*smoothstep(.002,.008,side));
  float chin=1.-smoothstep(.58,1.,length(vec2(p.x/.013,(p.y-1.648)/.006)));
  return clamp(max(max(cheeks*lower,moustache),chin)-lip,0.,1.)*front*(1.-smoothstep(.080,.088,side));
}
#endif
`;
export const WORKWEAR_PAINT = /* glsl */ `
float softOval(vec2 p, vec2 centre, vec2 radius) {
  return 1. - smoothstep(.56, 1., length((p-centre)/radius));
}
vec3 materialPigment(vec3 c, vec3 low, vec3 mid, vec3 high, vec3 p, vec3 normal, float lit) {
  #ifdef WORKWEAR
    float sky=clamp(.49+.30*normal.y+.17*dot(normal,uSunDir),0.,1.);
    vec3 fill=mix(low,mid,.26+.59*sky);
    c=mix(c,mix(fill,high,smoothstep(.25,.97,lit)),.65);
    // Big brush shapes hold at walking distance. The broken edges appear nearer.
    vec2 plane=vec2(p.x+.61*p.z, p.y-.18*p.z);
    float wash=texture(tNoise,plane*vec2(1.83,.81)+vec2(.31,.17)).r;
    float bristle=texture(tNoise,vec2(plane.x*6.8+plane.y*1.8,plane.y*1.10)+wash*.12).g;
    c=mix(c,mix(low,high,.24+.53*wash),.16);
    float closeDetail=1.-smoothstep(.012,.035,max(fwidth(plane.x),fwidth(plane.y)));
    c*=1.+.13*(wash-.5)+.11*(bristle-.5)*closeDetail;
    #if defined(CANVAS) || defined(CLOTH)
      float fleck=smoothstep(.53,.77,bristle+.08*wash);
      c=mix(c,mid*vec3(1.11,1.055,.93),.12*fleck*closeDetail);
      c*=1.-uWearWet*(.12+.13*max(normal.y,0.));
      #ifdef WORK_SHIRT
        float sleeve=smoothstep(.19,.27,abs(p.x))*smoothstep(1.32,1.40,p.y);
        vec2 grain=mix(vec2(p.x+.55*p.z,p.y),vec2(p.z-.44*p.y,p.x),sleeve);
        vec2 pick=abs(fract(grain*vec2(8.,9.5)+vec2(.17,.43))-.5);
        float broad=max(1.-smoothstep(.045,.13,pick.x),1.-smoothstep(.060,.15,pick.y));
        float stitch=1.-smoothstep(.016,.065,min(pick.x,pick.y));
        float shoulderSeam=1.-smoothstep(.002,.009,abs(p.y-(1.466-.12*abs(p.x))));
        float hem=1.-smoothstep(.003,.011,abs(p.y-1.028));
        float upper=smoothstep(.98,1.02,p.y);
        c=mix(c,c*vec3(.86,.88,.90),upper*(.72*broad+.19*stitch)*closeDetail);
        c*=1.-upper*(.12*hem+.15*shoulderSeam*smoothstep(.02,.12,-p.z));
      #endif
    #elif defined(FELT)
      float braid=texture(tNoise,vec2(p.y*17.+length(p.xz)*5.,(p.x-p.z)*1.45)).r;
      c*=1.+(braid-.5)*.16*closeDetail;
      c*=1.-uWearWet*(.115+.16*max(normal.y,0.));
    #elif defined(LEATHER)
      float polish=smoothstep(.52,.82,bristle)*(.15+.65*sky);
      c=mix(c,mix(mid,high,.55),.18*polish);
    #elif defined(BROW)
      float grain=texture(tNoise,vec2(p.x*8.+p.y*19.,p.y*2.)).r;
      c=mix(low,mix(mid,high,.26),.36+.47*grain+.14*sky);
    #elif defined(HAIR)
      float lock=texture(tNoise,vec2((p.x+p.z*.53)*9.,p.y*1.4)).r;
      c=mix(c,mix(mid,high,sky*.63),.27*smoothstep(.48,.76,lock));
    #elif defined(BARK)
      vec2 bark=vec2((p.x-p.z*.63)*7.3,p.y*.64);
      float fibre=texture(tNoise,bark+wash*.13).r;
      c=mix(c,mix(low,high,.22+.50*fibre),.34);
    #elif defined(ENDGRAIN)
      vec2 cut=p.xz-vec2(.006,-.003);float radius=length(cut),angle=atan(cut.y,cut.x);
      float growth=radius*94.+.14*sin(2.*angle+.8)+.07*sin(3.*angle);
      float line=abs(fract(growth)-.5);
      float rings=(1.-smoothstep(.030,.13+fwidth(growth),line))*closeDetail;
      float split=(1.-smoothstep(.015,.080,abs(sin(angle-.38))))*smoothstep(.021,.054,radius);
      c*=1.-.24*rings-.32*split;
    #elif defined(SKIN)
      // Warm cheeks and lips, a cool under-brow and small light planes on the nose.
      // These sit on the model's actual features on every skin tone.
      vec2 face=vec2(abs(p.x),p.y);
      float front=smoothstep(.060,.092,p.z)*smoothstep(1.59,1.63,p.y);
      float cheek=softOval(face,vec2(.049,1.694),vec2(.032,.032))*front;
      float bridge=softOval(face,vec2(0.,1.716),vec2(.011,.038))*front;
      float socket=softOval(face,vec2(.032,1.736),vec2(.025,.014))*front;
      float mouth=front*softOval(face,vec2(0.,1.661+.004*abs(p.x)/.025),vec2(.029,.006));
      float lowerLip=front*softOval(face,vec2(.002,1.654),vec2(.021,.004));
      float nose=front*softOval(face,vec2(.011,1.689),vec2(.007,.004));
      c=mix(c,mix(mid,high,.33)*vec3(1.12,.88,.83),cheek*.225);
      c=mix(c,mix(mid,high,.57),bridge*.28);
      c=mix(c,mix(low,mid,.26)*vec3(.94,.90,1.01),socket*.51);
      c=mix(c,mid*vec3(.55,.38,.42),mouth*.56+nose*.39);
      c=mix(c,mix(mid,high,.37)*vec3(1.10,.91,.89),lowerLip*.36);
      float groom=whiskerMask(p);
      float hairGrain=texture(tNoise,vec2((abs(p.x)-p.y*.38+.35*p.z)*17.,p.y*4.4)+wash*.11).r;
      float grainEdge=smoothstep(.10,.85,groom+(hairGrain-.50)*.27);
      float stubble=smoothstep(.36,.69,hairGrain)*.16+.065;
      float full=.65+.25*hairGrain;
      vec3 root=mix(low*.63,uWhisker*vec3(.48,.49,.52),.58);
      vec3 tip=uWhisker*1.11+vec3(.034,.029,.018);
      vec3 whisker=mix(root,tip,.14+.31*hairGrain+.29*sky+.18*lit);
      c=mix(c,whisker,grainEdge*min(1.,uBeard)*mix(stubble,full,max(0.,uBeard-1.)));
    #elif defined(EYES)
      vec2 eye=vec2(p.x-sign(p.x)*.030-uGaze,p.y);
      float iris=softOval(eye,vec2(0.,1.734),vec2(.008,.010));
      float pupil=softOval(eye,vec2(0.,1.734),vec2(.004,.006));
      float glint=softOval(eye,vec2(-.0025,1.737),vec2(.0022,.0022));
      c=mix(vec3(.49,.43,.35),vec3(.73,.65,.50),sky*.77);
      c=mix(c,vec3(.19,.19,.125),iris);c=mix(c,vec3(.078,.065,.057),pupil);
      c+=vec3(.42,.36,.22)*glint*(.31+.69*uDaylight);
      float top=mix(1.747,1.730,uBlink),bottom=mix(1.721,1.731,uBlink);
      float lid=clamp(smoothstep(top-.001,top+.001,p.y)+1.-smoothstep(bottom-.001,bottom+.001,p.y),0.,1.);
      vec3 flesh=mix(mix(uLidS,uLidM,.38+.32*sky),uLidL,lit*.32);
      flesh*=1.-.25*uBlink*(1.-smoothstep(.0008,.0028,abs(p.y-top)));
      c=mix(c,flesh,lid);
    #endif
  #endif
  return c;
}
`;
