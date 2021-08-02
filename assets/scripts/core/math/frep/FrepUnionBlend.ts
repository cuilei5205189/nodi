import FrepBase from './FrepBase';
import FrepBlend from './FrepBlend';

export default class FrepUnionBlend extends FrepBlend {
  constructor (left: FrepBase, right: FrepBase) {
    super('opUnion', left, right);

    const minmax0 = this.left.boundingBox.getMinMax();
    const minmax1 = this.right.boundingBox.getMinMax();
    const minX = Math.min(minmax0.min.x, minmax1.min.x);
    const minY = Math.min(minmax0.min.y, minmax1.min.y);
    const minZ = Math.min(minmax0.min.z, minmax1.min.z);
    const maxX = Math.max(minmax0.max.x, minmax1.max.x);
    const maxY = Math.max(minmax0.max.y, minmax1.max.y);
    const maxZ = Math.max(minmax0.max.z, minmax1.max.z);

    this.boundingBox = this.worldMinMaxToBoundingBox(minX, minY, minZ, maxX, maxY, maxZ);
  }
}
