import { db } from "@/lib/db"
import { generateId } from "@/lib/utils/id"
import type { Category } from "@/types"

export const categoryService = {
  async getAll(): Promise<Category[]> {
    return db.categories.orderBy("sortOrder").toArray()
  },

  async getById(id: string): Promise<Category | undefined> {
    return db.categories.get(id)
  },

  async getByType(type: "asset" | "liability"): Promise<Category[]> {
    return db.categories.where("type").equals(type).sortBy("sortOrder")
  },

  async getChildren(parentId: string): Promise<Category[]> {
    return db.categories.where("parentId").equals(parentId).sortBy("sortOrder")
  },

  async create(data: {
    name: string
    type: "asset" | "liability"
    parentId: string | null
  }): Promise<string> {
    // Validate: unique name among siblings
    const siblings = data.parentId
      ? await db.categories.where("parentId").equals(data.parentId).toArray()
      : await db.categories.where("parentId").equals("").toArray().then(() =>
          db.categories.filter((c) => c.parentId === null && c.type === data.type).toArray()
        )

    // Validate: max depth = 3
    if (data.parentId) {
      const parentDepth = await this._getCategoryDepth(data.parentId)
      if (parentDepth >= 3) {
        throw new Error("分类最多支持三级层级")
      }
    }

    if (siblings.some((s) => s.name === data.name)) {
      throw new Error("同级下已存在同名分类")
    }

    const maxSort = siblings.length > 0
      ? Math.max(...siblings.map((s) => s.sortOrder))
      : -1

    const now = Date.now()
    const id = generateId()

    await db.categories.add({
      id,
      name: data.name,
      type: data.type,
      parentId: data.parentId,
      sortOrder: maxSort + 1,
      isArchived: false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    return id
  },

  async update(id: string, data: Partial<Pick<Category, "name" | "parentId" | "sortOrder">>): Promise<void> {
    // If changing parentId, check for circular reference
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new Error("不能将分类设为自己的子分类")
      }
      if (data.parentId !== null) {
        // Walk up the tree to check for cycles
        let current = data.parentId
        while (current) {
          if (current === id) {
            throw new Error("不能形成循环的父子关系")
          }
          const parent = await db.categories.get(current)
          current = parent?.parentId || ""
          if (!current) break
        }
      }
    }

    // Validate max depth = 3 when changing parentId
    if (data.parentId !== undefined && data.parentId !== null) {
      const parentDepth = await this._getCategoryDepth(data.parentId)
      if (parentDepth >= 3) {
        throw new Error("分类最多支持三级层级")
      }
    }

    // Check unique name among new siblings if name or parentId changed
    if (data.name !== undefined || data.parentId !== undefined) {
      const existing = await db.categories.get(id)
      if (!existing) throw new Error("分类不存在")

      const targetParentId = data.parentId !== undefined ? data.parentId : existing.parentId
      const targetName = data.name !== undefined ? data.name : existing.name

      const siblings = await db.categories
        .filter((c) => c.parentId === targetParentId && c.type === existing.type && c.id !== id)
        .toArray()

      if (siblings.some((s) => s.name === targetName)) {
        throw new Error("同级下已存在同名分类")
      }
    }

    await db.categories.update(id, {
      ...data,
      updatedAt: Date.now(),
    })
  },

  async archive(id: string): Promise<void> {
    await db.categories.update(id, {
      isArchived: true,
      updatedAt: Date.now(),
    })
  },

  async restore(id: string): Promise<void> {
    await db.categories.update(id, {
      isArchived: false,
      updatedAt: Date.now(),
    })
  },

  /** Get the depth of a category (L1=1, L2=2, L3=3) */
  async _getCategoryDepth(id: string): Promise<number> {
    let depth = 1
    let catId: string = id
    while (true) {
      const cat = await db.categories.get(catId)
      if (!cat?.parentId) break
      depth++
      catId = cat.parentId
    }
    return depth
  },

  /** Collect all descendant IDs (children, grandchildren, etc.) */
  async _collectDescendantIds(id: string): Promise<string[]> {
    const ids: string[] = []
    const children = await db.categories.where("parentId").equals(id).toArray()
    for (const child of children) {
      ids.push(child.id)
      const grandchildren = await this._collectDescendantIds(child.id)
      ids.push(...grandchildren)
    }
    return ids
  },

  async canDelete(id: string): Promise<{
    canDelete: boolean
    reason?: string
    hasChildren?: boolean
    linkedAccounts?: { id: string; name: string; categoryName: string }[]
  }> {
    // Check if any category in this tree has linked accounts
    const allIds = [id, ...(await this._collectDescendantIds(id))]
    const linkedAccounts: { id: string; name: string; categoryName: string }[] = []

    for (const catId of allIds) {
      const accounts = await db.accounts.where("categoryId").equals(catId).toArray()
      if (accounts.length > 0) {
        const cat = await db.categories.get(catId)
        for (const acc of accounts) {
          linkedAccounts.push({
            id: acc.id,
            name: acc.name,
            categoryName: cat?.name ?? "",
          })
        }
      }
    }

    if (linkedAccounts.length > 0) {
      const names = linkedAccounts.map((a) => `「${a.name}」`).join("、")
      return {
        canDelete: false,
        reason: `该分类下有 ${linkedAccounts.length} 个账户（${names}），需要先去账户页编辑移动到其他分类，或删除这些账户后才能删除分类。`,
        linkedAccounts,
      }
    }

    const children = await db.categories.where("parentId").equals(id).count()
    return { canDelete: true, hasChildren: children > 0 }
  },

  /** Get max depth of the subtree rooted at id (leaf=1, with children=1+max(child depths)) */
  async _getSubtreeMaxDepth(id: string): Promise<number> {
    const children = await db.categories.where("parentId").equals(id).toArray()
    if (children.length === 0) return 1
    let max = 0
    for (const child of children) {
      const d = await this._getSubtreeMaxDepth(child.id)
      if (d > max) max = d
    }
    return 1 + max
  },

  /** Move a category to a new parent and/or sort position */
  async moveCategory(
    categoryId: string,
    targetParentId: string | null,
    sortIndex: number | null
  ): Promise<void> {
    await db.transaction("rw", [db.categories], async () => {
      const category = await db.categories.get(categoryId)
      if (!category) throw new Error("分类不存在")

      // Determine effective target parent
      const newParentId = targetParentId

      // Circular reference check
      if (newParentId !== null) {
        if (newParentId === categoryId) {
          throw new Error("不能将分类设为自己的子分类")
        }
        // Walk up from target to root, ensure we don't hit categoryId
        let current: string | null = newParentId
        while (current) {
          if (current === categoryId) {
            throw new Error("不能形成循环的父子关系")
          }
          const parent: Category | undefined = await db.categories.get(current)
          current = parent?.parentId ?? null
        }
      }

      // Depth check: target depth + subtree max depth <= 3
      if (newParentId !== null) {
        const targetDepth = await this._getCategoryDepth(newParentId)
        const subtreeMaxDepth = await this._getSubtreeMaxDepth(categoryId)
        if (targetDepth + subtreeMaxDepth > 3) {
          throw new Error("分类最多支持三级层级")
        }
      } else {
        // Moving to root: subtree depth must be <= 3
        const subtreeMaxDepth = await this._getSubtreeMaxDepth(categoryId)
        if (subtreeMaxDepth > 3) {
          throw new Error("分类最多支持三级层级")
        }
      }

      // Get new siblings (excluding the category itself)
      const newSiblings = await db.categories
        .filter((c) => c.parentId === newParentId && c.type === category.type && c.id !== categoryId)
        .sortBy("sortOrder")

      // Determine effective sort index
      const effectiveIndex = sortIndex !== null ? Math.min(sortIndex, newSiblings.length) : newSiblings.length

      // No-op detection: same parent and same position
      if (category.parentId === newParentId) {
        // Check if position is actually changing
        const currentSiblings = await db.categories
          .filter((c) => c.parentId === newParentId && c.type === category.type)
          .sortBy("sortOrder")
        const currentIndex = currentSiblings.findIndex((c) => c.id === categoryId)
        if (currentIndex === effectiveIndex || (effectiveIndex > currentIndex && effectiveIndex === currentIndex + 1)) {
          return // no-op
        }
      }

      // If parent is changing, re-sort old siblings to fill gap
      if (category.parentId !== newParentId) {
        const oldSiblings = await db.categories
          .filter((c) => c.parentId === category.parentId && c.type === category.type && c.id !== categoryId)
          .sortBy("sortOrder")
        for (let i = 0; i < oldSiblings.length; i++) {
          if (oldSiblings[i].sortOrder !== i) {
            await db.categories.update(oldSiblings[i].id, { sortOrder: i, updatedAt: Date.now() })
          }
        }
      }

      // Insert into new position: shift siblings at and after effectiveIndex
      for (let i = newSiblings.length - 1; i >= effectiveIndex; i--) {
        await db.categories.update(newSiblings[i].id, {
          sortOrder: i + 1,
          updatedAt: Date.now(),
        })
      }

      // Update the moved category
      await db.categories.update(categoryId, {
        parentId: newParentId,
        sortOrder: effectiveIndex,
        updatedAt: Date.now(),
      })
    })
  },

  /** Increment usageCount when this category is selected as parent */
  async incrementUsageCount(id: string): Promise<void> {
    const cat = await db.categories.get(id)
    if (!cat) return
    await db.categories.update(id, { usageCount: (cat.usageCount ?? 0) + 1 })
  },

  /** Delete a category and all its descendants (cascade) */
  async delete(id: string): Promise<void> {
    const check = await this.canDelete(id)
    if (!check.canDelete) {
      throw new Error(check.reason)
    }

    const allIds = [id, ...(await this._collectDescendantIds(id))]
    await db.categories.bulkDelete(allIds)
  },
}
