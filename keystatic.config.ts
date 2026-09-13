import { config, fields, collection, singleton } from '@keystatic/core';

/* Money is stored in CAD cents as an integer. Never floats — 275.00 * 100 in
   JS is 27499.999999999996, and that rounding error becomes a real mispriced
   order. The importer converts once, everything downstream stays integer. */
const cents = (label: string, description?: string) =>
  fields.integer({ label, description, validation: { isRequired: true, min: 0 } });

/* A variant is the unit that actually has a price and a stock level.
   Fixed-size rings have exactly one; made-to-order rings have one per size. */
const variant = fields.object(
  {
    size: fields.text({
      label: 'Ring size',
      description: 'Leave blank when the ring has only one size.',
    }),
    price: cents('Price (CAD cents)', 'e.g. 29000 = $290.00'),
    salePrice: fields.integer({
      label: 'Sale price (CAD cents)',
      description: 'Leave blank when not on sale. Blank is the only "not on sale" state.',
      validation: { isRequired: false, min: 0 },
    }),
    stock: fields.text({
      label: 'Stock',
      description: '"unlimited", or a whole number for limited pieces.',
      defaultValue: 'unlimited',
      validation: { isRequired: true },
    }),
  },
  { label: 'Variant' }
);

export default config({
  storage:
    process.env.NODE_ENV === 'development'
      ? { kind: 'local' }
      : { kind: 'github', repo: { owner: 'ferncabrera', name: 'boldermade' } },

  ui: {
    brand: { name: 'bolder' },
    navigation: {
      Shop: ['products'],
      Pages: ['pages'],
      Settings: ['siteSettings', 'shipping'],
    },
  },

  collections: {
    products: collection({
      label: 'Rings',
      slugField: 'title',
      path: 'content/products/*',
      format: { contentField: 'description' },
      columns: ['title', 'status'],
      entryLayout: 'content',
      schema: {
        title: fields.slug({
          name: { label: 'Ring name', validation: { isRequired: true } },
          slug: {
            label: 'URL slug',
            description:
              'Appears at /shop/p/<slug>. Sold rings keep their page forever, so a repeat name needs a suffix, e.g. opal-shark-sz-10-2.',
          },
        }),

        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Published', value: 'published' },
            { label: 'Draft (hidden from the site)', value: 'draft' },
          ],
          defaultValue: 'draft',
        }),

        sizing: fields.select({
          label: 'Sizing',
          description:
            'Fixed = one size, baked into the name. Variants = customer chooses, price can differ per size. Adjustable = fits a range.',
          options: [
            { label: 'Fixed size', value: 'fixed' },
            { label: 'Customer picks a size', value: 'variants' },
            { label: 'Adjustable', value: 'adjustable' },
          ],
          defaultValue: 'fixed',
        }),
        fixedSize: fields.text({ label: 'Size', description: 'For fixed-size rings, e.g. 10 or 7.25' }),
        sizeRange: fields.text({ label: 'Adjustable range', description: 'e.g. 8-9.5' }),

        variants: fields.array(variant, {
          label: 'Pricing & stock',
          description: 'Fixed and adjustable rings need exactly one entry.',
          itemLabel: (p) => `${p.fields.size.value || 'one size'} — $${(p.fields.price.value ?? 0) / 100}`,
          validation: { length: { min: 1 } },
        }),

        leadTime: fields.text({
          label: 'Lead time',
          description: 'Shown on made-to-order rings, e.g. "3–4 weeks".',
        }),

        materials: fields.array(fields.text({ label: 'Material' }), {
          label: 'Materials',
          itemLabel: (p) => p.value ?? '',
        }),
        stone: fields.text({ label: 'Stone' }),

        images: fields.array(
          fields.object({
            key: fields.text({
              label: 'Image key',
              description: 'Object key in the R2 bucket.',
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: 'Alt text',
              description:
                'Required. Describe the ring for someone who cannot see it — this is also how Google Images finds her work.',
              validation: { isRequired: true },
            }),
          }),
          {
            label: 'Photos',
            itemLabel: (p) => p.fields.alt.value || p.fields.key.value || 'photo',
            validation: { length: { min: 1 } },
          }
        ),

        description: fields.markdoc({ label: 'Description' }),
        care: fields.markdoc({ label: 'Care instructions' }),

        seoTitle: fields.text({ label: 'SEO title', description: 'Defaults to the ring name.' }),
        seoDescription: fields.text({
          label: 'SEO description',
          description: 'One or two sentences for Google. Defaults to the start of the description.',
          multiline: true,
        }),

        legacySlugs: fields.array(fields.text({ label: 'Old URL slug' }), {
          label: 'Old Squarespace slugs',
          description: 'Each one becomes a 301 redirect. Do not remove these.',
          itemLabel: (p) => p.value ?? '',
        }),
      },
    }),

    pages: collection({
      label: 'Pages',
      slugField: 'title',
      path: 'content/pages/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        seoTitle: fields.text({ label: 'SEO title' }),
        seoDescription: fields.text({ label: 'SEO description', multiline: true }),
        body: fields.markdoc({ label: 'Content' }),
      },
    }),
  },

  singletons: {
    siteSettings: singleton({
      label: 'Site settings',
      path: 'content/settings/site',
      schema: {
        tagline: fields.text({ label: 'Tagline' }),
        announcement: fields.text({ label: 'Announcement bar', description: 'Leave blank to hide.' }),
        instagramUrl: fields.url({ label: 'Instagram URL' }),
        contactEmail: fields.text({ label: 'Contact email' }),
        defaultSeoDescription: fields.text({ label: 'Default SEO description', multiline: true }),
      },
    }),

    shipping: singleton({
      label: 'Shipping',
      path: 'content/settings/shipping',
      schema: {
        zones: fields.array(
          fields.object({
            label: fields.text({ label: 'Zone name', validation: { isRequired: true } }),
            countries: fields.array(fields.text({ label: 'ISO country code' }), {
              label: 'Countries (ISO 2-letter, e.g. CA, US)',
              itemLabel: (p) => p.value ?? '',
            }),
            rate: cents('Rate (CAD cents)'),
            deliveryEstimate: fields.text({ label: 'Delivery estimate', description: 'e.g. 5–10 business days' }),
          }),
          { label: 'Zones', itemLabel: (p) => `${p.fields.label.value} — $${(p.fields.rate.value ?? 0) / 100}` }
        ),
      },
    }),
  },
});
