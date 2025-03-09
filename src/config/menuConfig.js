import { MENU_ITEM_TYPES } from '@/constants/menuItemTypes';

/**
 * 菜单配置项
 * @typedef {Object} MenuItem
 * @property {string} id - 菜单项唯一ID
 * @property {string} type - 菜单项类型 (section | item | submenu)
 * @property {string} label - 菜单项显示文本
 * @property {Function} [onClick] - 点击处理函数
 * @property {MenuItem[]} [submenu] - 子菜单项列表
 */

/**
 * 获取菜单配置
 * @param {Function} onAddNode - 添加节点回调函数
 * @returns {MenuItem[]} 菜单配置项
 */
export const getMenuConfig = (onAddNode) => [
  {
    id: 'basic-section',
    type: MENU_ITEM_TYPES.SECTION,
    label: '基础节点',
  },
  {
    id: 'input',
    type: MENU_ITEM_TYPES.ITEM,
    label: '输入节点',
    onClick: () => onAddNode('input'),
  },
  {
    id: 'output',
    type: MENU_ITEM_TYPES.ITEM,
    label: '输出节点',
    onClick: () => onAddNode('output'),
  },
  {
    id: 'processing-section',
    type: MENU_ITEM_TYPES.SECTION,
    label: '处理节点',
  },
  {
    id: 'default',
    type: MENU_ITEM_TYPES.ITEM,
    label: '默认节点',
    onClick: () => onAddNode('default'),
  },
  {
    id: 'advanced',
    type: MENU_ITEM_TYPES.SUBMENU,
    label: '高级节点',
    submenu: [
      {
        id: 'custom',
        type: MENU_ITEM_TYPES.ITEM,
        label: '自定义节点',
        onClick: () => onAddNode('custom'),
      },
      {
        id: 'conditional',
        type: MENU_ITEM_TYPES.ITEM,
        label: '条件节点',
        onClick: () => onAddNode('conditional'),
      },
      {
        id: 'loop',
        type: MENU_ITEM_TYPES.ITEM,
        label: '循环节点',
        onClick: () => onAddNode('loop'),
      },
    ],
  },
];
