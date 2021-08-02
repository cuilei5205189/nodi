import { Vector3 } from 'three';
import { AccessTypes } from '../../../data/AccessTypes';
import DataAccess from '../../../data/DataAccess';
import DataTree from '../../../data/DataTree';
import { DataTypes } from '../../../data/DataTypes';
import InputManager from '../../../io/InputManager';
import OutputManager from '../../../io/OutputManager';
import FrepShape from '../../../math/frep/FrepShape';
import FrepTransform from '../../../math/frep/FrepTransform';
import { NBoundingBox, NPlane, NPoint } from '../../../math/geometry';
import { NDomain } from '../../../math/primitive';
import FrepNodeBase from '../FrepNodeBase';

export default class FSphere extends FrepNodeBase {
  public get displayName (): string {
    return 'FSphere';
  }

  public registerInputs (manager: InputManager): void {
    manager.add('p', 'Base position', DataTypes.POINT, AccessTypes.ITEM).setDefault(new DataTree().add([new NPoint()]));
    manager.add('r', 'Radius', DataTypes.NUMBER, AccessTypes.ITEM).setDefault(new DataTree().add([0.5]));
  }

  public registerOutputs (manager: OutputManager): void {
    manager.add('f', 'Frep sphere', DataTypes.FREP, AccessTypes.ITEM);
  }

  public solve (access: DataAccess): void {
    const v = access.getData(0) as NPoint;
    let r = access.getData(1) as number;
    r = Math.max(r, Number.EPSILON);

    const f = function (p: string) {
      return `sdSphere(${p}, ${r.toFixed(2)})`;
    };
    const plane = new NPlane();
    const bb = new NBoundingBox(plane, new NDomain(-r, r), new NDomain(-r, r), new NDomain(-r, r));
    const shape = new FrepShape(f, bb);
    const frep = new FrepTransform(shape, v);
    access.setData(0, frep);
  }
}
