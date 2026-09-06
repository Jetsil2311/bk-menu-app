const createId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`

export const createOptionGroup = () => ({
  id: createId('group'),
  name: '',
  type: 'single',
  required: false,
  options: [],
})

export const createMenuOption = () => ({
  id: createId('opt'),
  name: '',
  priceModifier: 0,
})

export const updateOptionGroup = (groups, groupIndex, field, value) =>
  groups.map((group, index) => index === groupIndex ? { ...group, [field]: value } : group)

export const removeOptionGroup = (groups, groupIndex) => groups.filter((_, index) => index !== groupIndex)

export const addOptionToGroup = (groups, groupIndex, option = createMenuOption()) =>
  groups.map((group, index) => index === groupIndex
    ? { ...group, options: [...(group.options || []), option] }
    : group)

export const updateOptionInGroup = (groups, groupIndex, optionIndex, field, value) =>
  groups.map((group, currentGroupIndex) => {
    if (currentGroupIndex !== groupIndex) return group
    return {
      ...group,
      options: (group.options || []).map((option, currentOptionIndex) =>
        currentOptionIndex === optionIndex ? { ...option, [field]: value } : option),
    }
  })

export const removeOptionFromGroup = (groups, groupIndex, optionIndex) =>
  groups.map((group, currentGroupIndex) => currentGroupIndex === groupIndex
    ? { ...group, options: (group.options || []).filter((_, index) => index !== optionIndex) }
    : group)
