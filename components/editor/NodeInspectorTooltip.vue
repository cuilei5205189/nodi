<template>
  <div
    v-show="isVisible"
    ref="root"
    class="tooltip node-inspector-box py-2"
    @mousedown.stop="onMouseDown"
    @mouseup.stop="onMouseUp"
  >
    <div class="item" :class="{ 'mb-2': hasDefaultInput || hasCustomInspector }">
      <a class="name d-inline-flex m-0" :href="`/nodes/${name}`" target="_blank">{{ name }}<i class="ml-1 d-inline-flex flex-items-center" v-html="svg.linkExternal" /></a>
      <p v-show="description.length > 0" class="m-0" v-text="description" />
      <p v-show="error.length > 0" class="error m-0" v-text="error" />
    </div>
    <div v-show="hasDefaultInput" class="item">
      <h3>Default inputs</h3>
      <ul ref="DefaultInputList" />
    </div>
    <div v-show="hasCustomInspector" ref="CustomInspectorBlock" class="item" />
  </div>
</template>

<script lang='ts'>

import { v4 } from 'uuid';
import { Vue, Component } from 'nuxt-property-decorator';
import octicons from '@primer/octicons';
import { Vector2, Vector3 } from 'three';

import Tooltip from './Tooltip.vue';
import NumberInput from './inspectors/ui/NumberInput.vue';
import DomainInput from './inspectors/ui/DomainInput.vue';
import PlaneInput from './inspectors/ui/PlaneInput.vue';
import Vector3Input from './inspectors/ui/Vector3Input.vue';
import BooleanInput from './inspectors/ui/BooleanInput.vue';
import StringInput from './inspectors/ui/StringInput.vue';
import LabelInput from './inspectors/LabelInput.vue';
import VariableInputCount from './inspectors/VariableInputCount.vue';
import VariableOutputCount from './inspectors/VariableOutputCount.vue';
import CustomInspector from './inspectors/CustomInspector.vue';
import Node from '~/assets/scripts/core/nodes/NodeBase';

import { DataTypes } from '~/assets/scripts/core/data/DataTypes';
import Input from '~/assets/scripts/core/io/Input';
import UINodeBase from '~/assets/scripts/core/nodes/params/ui/UINodeBase';
import VariableInputNodeBase from '~/assets/scripts/core/nodes/VariableInputNodeBase';
import VariableOutputNodeBase from '~/assets/scripts/core/nodes/VariableOutputNodeBase';
import NodeDescription from '~/assets/json/description.json';
import Custom, { CustomPayloadType } from '~/assets/scripts/core/nodes/plugins/Custom';
import { isImporterNode } from '~/assets/scripts/core/nodes/IImporterNode';
import { NPlane, NPoint } from '~/assets/scripts/core/math/geometry';
import { NDomain } from '~/assets/scripts/core/math/primitive';

@Component({})
export default class NodeInspectorTooltip extends Tooltip {
  $refs!: {
    root: HTMLDivElement;
    DefaultInputList: HTMLUListElement;
    CustomInspectorBlock: HTMLDivElement;
  };

  svg = {
    linkExternal: octicons['link-external'].toSVG({ height: 12 })
  };

  name: string = '';
  description: string = '';
  experimental: boolean = false;
  error: string = '';
  hasDefaultInput: boolean = false;
  hasCustomInspector: boolean = false;
  instances: Vue[] = [];

  show (position: Vector2) {
    this.move(position.x, position.y);
    this.isVisible = true;
    this.$emit('hidden', this.isVisible);
  }

  clear () {
    this.removeAllChildren(this.$refs.DefaultInputList);
    this.removeAllChildren(this.$refs.CustomInspectorBlock);
    this.instances.forEach((instance) => {
      instance.$destroy();
    });
    this.instances = [];
  }

  removeAllChildren (node: HTMLElement): void {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  inferenceDataType (value: any): DataTypes {
    const type = typeof value;
    if (type === 'string') { return DataTypes.STRING; }
    if (type === 'boolean') { return DataTypes.BOOLEAN; }
    if (type === 'number') { return DataTypes.NUMBER; }
    if (value instanceof NPoint) { return DataTypes.POINT; }
    if (value instanceof Vector3) { return DataTypes.VECTOR; }
    if (value instanceof NDomain) { return DataTypes.DOMAIN; }
    if (value instanceof NPlane) { return DataTypes.PLANE; }
    return DataTypes.NONE;
  }

  setup (node: Node) {
    this.clear();

    this.name = node.constructor.name;
    this.description = (this.name in NodeDescription) ? NodeDescription[this.name] : '';
    const message = node.getErrorMessage();
    this.error = (message !== null) ? message : '';
    this.experimental = node.experimental;

    const count = node.inputManager.getIOCount();
    for (let i = 0; i < count; i++) {
      const input = node.inputManager.getInput(i);
      if (input.hasDefault()) {
        const item = input.getDefault().getItemsByIndex(0)[0];
        const dataType = this.inferenceDataType(item);
        const instance = this.createDefaultInput(node, input, dataType, item);
        if (instance !== undefined) {
          this.$refs.DefaultInputList.appendChild(instance.$el);
          this.instances.push(instance);
        }
      }
    }

    if (node instanceof UINodeBase) {
      const instance = new (Vue.extend(LabelInput))({
        propsData: {
          value: node.getLabel()
        }
      });
      instance.$on('change', (label: string) => {
        node.setLabel(label);
      });
      instance.$mount();
      this.$refs.CustomInspectorBlock.appendChild(instance.$el);
      this.instances.push(instance);
    }

    if (node instanceof VariableInputNodeBase) {
      const instance = new (Vue.extend(VariableInputCount))({
        propsData: {
          value: node.getInputCount(),
          min: node.getMinInputCount(),
          max: node.getMaxInputCount()
        }
      });
      instance.$on('change', (value: number) => {
        node.setInputCount(value);
      });
      instance.$mount();
      this.$refs.CustomInspectorBlock.appendChild(instance.$el);
      this.instances.push(instance);
    }

    if (node instanceof VariableOutputNodeBase) {
      const instance = new (Vue.extend(VariableOutputCount))({
        propsData: {
          value: node.getOutputCount(),
          min: node.getMinOutputCount(),
          max: node.getMaxOutputCount()
        }
      });
      instance.$on('change', (value: number) => {
        node.setOutputCount(value);
      });
      instance.$mount();
      this.$refs.CustomInspectorBlock.appendChild(instance.$el);
      this.instances.push(instance);
    }

    if (isImporterNode(node)) {
      node.onImportFile.on((e) => {
        const { blob, key, name, folder } = e;
        const separated = name.split('.');
        const ext = separated[separated.length - 1];
        const id = v4();
        const path = `${folder}/${id}.${ext}`;
        this.$storage.ref(path).put(blob).then((snapshot) => {
          return snapshot.ref.getDownloadURL();
        }).then((url) => {
          node.registerFile(key, name, url);
        });
      });
    }

    if (node instanceof Custom) {
      const payload = node.getCustomSetting();
      const instance = new (Vue.extend(CustomInspector))({
        propsData: payload
      });
      instance.$on('change', (payload: CustomPayloadType) => {
        node.updateCustomSetting(payload);
      });
      instance.$mount();
      this.$refs.CustomInspectorBlock.appendChild(instance.$el);
      this.instances.push(instance);
    }

    node.setupInspectorElement(this.$refs.CustomInspectorBlock);

    this.hasDefaultInput = this.$refs.DefaultInputList.childElementCount > 0;
    this.hasCustomInspector = this.$refs.CustomInspectorBlock.childElementCount > 0;
  }

  createDefaultInput (node: Node, input: Input, type: DataTypes, item: any): Vue | undefined {
    let constructor: any;

    switch (type) {
      case DataTypes.NUMBER: {
        constructor = Vue.extend(NumberInput);
        break;
      }
      case DataTypes.BOOLEAN: {
        constructor = Vue.extend(BooleanInput);
        break;
      }
      case DataTypes.DOMAIN: {
        constructor = Vue.extend(DomainInput);
        break;
      }
      case DataTypes.VECTOR: {
        constructor = Vue.extend(Vector3Input);
        break;
      }
      case DataTypes.PLANE: {
        constructor = Vue.extend(PlaneInput);
        break;
      }
      case DataTypes.STRING: {
        constructor = Vue.extend(StringInput);
        break;
      }
      default: {
        return undefined;
      }
    }

    const instance = new constructor({
      propsData: {
        label: input.getDescription(),
        value: item
      }
    });
    instance.$on('change', (value: any) => {
      input.getDefault().getBranchByIndex(0)?.setValue([value]);
      node.notifyValueChanged();
    });
    instance.$mount();

    return instance;
  }
}

</script>
