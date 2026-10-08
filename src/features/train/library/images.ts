// OWNER: ui-library. Turns the media field (a path relative to the public
// root, without extension or size suffix) into img attributes. Sizes follow
// docs/SPEC-image-sources.md: 256 and 512 px WebP. If the images builder
// settles on a different suffix, this is the one place to change.

export const IMAGE_WIDTHS = [256, 512] as const

const root = (): string => {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

export function imageUrl(path: string, width: (typeof IMAGE_WIDTHS)[number]): string {
  return `${root()}${path.replace(/^\/+/, '')}-${width}.webp`
}

export interface ImageAttrs {
  src: string
  srcSet: string
  sizes?: string
}

/** src is the small file (cheap everywhere); srcSet lets the browser pick 512 on wide or dense screens. */
export function imageAttrs(path: string, sizes: string): ImageAttrs {
  return {
    src: imageUrl(path, 256),
    srcSet: IMAGE_WIDTHS.map((w) => `${imageUrl(path, w)} ${w}w`).join(', '),
    sizes,
  }
}
