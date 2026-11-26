import { COMPANY, REPOSITORY } from '@todz/types';
import { LANDING_COPY } from './landing-copy';
import { scriptJson } from './site-constants';
import { OPEN_GRAPH_IMAGE } from './site-icons';
import { DOCS_URL, DOWNLOAD_URL, SITE_URL } from './site-urls';

const SCHEMA_URL = 'https://schema.org';
const LANGUAGE = 'en';
const OPERATING_SYSTEM = 'macOS 14 or later';
const APPLICATION_CATEGORY = 'BusinessApplication';
const APPLICATION_SUB_CATEGORY = 'Productivity';
const FREE_PRICE = '0';
const PRICE_CURRENCY = 'USD';
const IN_STOCK_AVAILABILITY = `${SCHEMA_URL}/InStock`;

enum SchemaType {
  Organization = 'Organization',
  WebSite = 'WebSite',
  SoftwareApplication = 'SoftwareApplication',
  Offer = 'Offer',
}

const ORGANIZATION_ID = `${SITE_URL}/#publisher`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APPLICATION_ID = `${SITE_URL}/#app`;
const PUBLISHER = { '@id': ORGANIZATION_ID };

const ORGANIZATION = {
  '@type': SchemaType.Organization,
  '@id': ORGANIZATION_ID,
  name: COMPANY.tradeName,
  legalName: COMPANY.legalName,
  url: COMPANY.website,
  logo: COMPANY.logo,
};

const WEBSITE = {
  '@type': SchemaType.WebSite,
  '@id': WEBSITE_ID,
  name: LANDING_COPY.meta.siteName,
  url: `${SITE_URL}/`,
  inLanguage: LANGUAGE,
  publisher: PUBLISHER,
};

const APPLICATION = {
  '@type': SchemaType.SoftwareApplication,
  '@id': APPLICATION_ID,
  name: LANDING_COPY.meta.siteName,
  description: LANDING_COPY.meta.description,
  url: `${SITE_URL}/`,
  image: `${SITE_URL}${OPEN_GRAPH_IMAGE.path}`,
  operatingSystem: OPERATING_SYSTEM,
  applicationCategory: APPLICATION_CATEGORY,
  applicationSubCategory: APPLICATION_SUB_CATEGORY,
  publisher: PUBLISHER,
  codeRepository: REPOSITORY.url,
  license: REPOSITORY.licenseSpdxUrl,
  downloadUrl: DOWNLOAD_URL,
  sameAs: [REPOSITORY.url, DOCS_URL],
  offers: {
    '@type': SchemaType.Offer,
    price: FREE_PRICE,
    priceCurrency: PRICE_CURRENCY,
    availability: IN_STOCK_AVAILABILITY,
    url: DOWNLOAD_URL,
  },
};

function structuredDataOf(graph: object[]): string {
  return scriptJson({ '@context': SCHEMA_URL, '@graph': graph });
}

export const LANDING_STRUCTURED_DATA = structuredDataOf([ORGANIZATION, WEBSITE, APPLICATION]);
