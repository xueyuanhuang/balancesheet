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
