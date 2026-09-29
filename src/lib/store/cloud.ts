import type { SupabaseClient } from '@supabase/supabase-js'
import type { Artwork, Child, Collection } from '../types'
import type { Store } from './types'

const BUCKET = 'art'
const URL_TTL = 60 * 60 // секунд

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export function createCloudStore(sb: SupabaseClient): Store {
  const urls = new Map<string, { url: string; expires: number }>()

  async function upload(path: string, blob: Blob) {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    })
    if (error) throw new Error(error.message)
  }

  async function invoke3D(action: 'start' | 'status', id: string): Promise<Artwork> {
    const { data, error } = await sb.functions.invoke<{ artwork?: Artwork; error?: string }>('generate-3d', {
      body: { action, artworkId: id },
    })
    if (error) {
      // Тело ответа функции обычно объясняет, что пошло не так.
      let message = error.message
      try {
        const body = await (error as { context?: Response }).context?.json()
        if (body?.error) message = body.error
      } catch {
        /* оставляем исходное сообщение */
      }
      throw new Error(message)
    }
    if (!data?.artwork) throw new Error(data?.error ?? 'Пустой ответ сервера')
    return data.artwork
  }

  return {
    mode: 'cloud',
    can3D: true,

    async load() {
      const [children, collections, artworks] = await Promise.all([
        sb.from('children').select('*').order('sort'),
        sb.from('collections').select('*').order('created_at'),
        sb.from('artworks').select('*').order('made_on', { ascending: false }).order('created_at', { ascending: false }),
      ])
      return {
        children: check(children) as Child[],
        collections: check(collections) as Collection[],
        artworks: check(artworks) as Artwork[],
      }
    },

    async updateChild(id, patch) {
      check(await sb.from('children').update(patch).eq('id', id))
    },

    async createCollection(name, color) {
      return check(await sb.from('collections').insert({ name, color }).select().single()) as Collection
    },

    async updateCollection(id, patch) {
      check(await sb.from('collections').update(patch).eq('id', id))
    },

    async deleteCollection(id) {
      check(await sb.from('collections').delete().eq('id', id))
    },

    async createArtwork(kind, meta, files) {
      const id = crypto.randomUUID()
      const ext = files.image.type === 'image/png' ? 'png' : 'jpg'
      const image_path = `${id}/image.${ext}`
      const thumb_path = `${id}/thumb.${ext}`
      const photo_paths = files.photos.map((_, i) => `${id}/photo-${i + 1}.jpg`)
      await Promise.all([
        upload(image_path, files.image),
        upload(thumb_path, files.thumb),
        ...files.photos.map((p, i) => upload(photo_paths[i], p)),
      ])
      const row = {
        id,
        kind,
        ...meta,
        image_path,
        thumb_path,
        aspect: files.aspect,
        photo_paths,
      }
      try {
        return check(await sb.from('artworks').insert(row).select().single()) as Artwork
      } catch (e) {
        await sb.storage.from(BUCKET).remove([image_path, thumb_path, ...photo_paths])
        throw e
      }
    },

    async updateArtwork(id, patch) {
      check(await sb.from('artworks').update(patch).eq('id', id))
    },

    async deleteArtwork(art) {
      check(await sb.from('artworks').delete().eq('id', art.id))
      const paths = [art.image_path, art.thumb_path, ...art.photo_paths, art.model_path].filter(Boolean) as string[]
      await sb.storage.from(BUCKET).remove(paths)
    },

    async fileUrl(path) {
      const cached = urls.get(path)
      if (cached && cached.expires > Date.now()) return cached.url
      const data = check(await sb.storage.from(BUCKET).createSignedUrl(path, URL_TTL))
      if (!data) throw new Error(`Файл не найден: ${path}`)
      urls.set(path, { url: data.signedUrl, expires: Date.now() + (URL_TTL - 300) * 1000 })
      return data.signedUrl
    },

    start3D: (id) => invoke3D('start', id),
    check3D: (id) => invoke3D('status', id),
  }
}
