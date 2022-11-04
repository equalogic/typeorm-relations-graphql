<div align="center">
  <img src="https://github.com/equalogic/typeorm-graphql-joiner/raw/master/resources/logo@720w.png" width="720" height="420">
  <br>
  <br>
  <a href="https://npmjs.com/package/typeorm-graphql-joiner">
    <img src="https://img.shields.io/npm/v/typeorm-graphql-joiner">
  </a>
  <a href="https://npmjs.com/package/typeorm-graphql-joiner">
    <img src="https://img.shields.io/npm/dy/typeorm-graphql-joiner">
  </a>
  <br>
  <br>
</div>

Automatically determine the entity relationships that must be `JOIN`ed in a TypeORM query to satisfy nested object
fields selected by a client in a GraphQL query.

Can be used as a potentially higher performance alternative to the [DataLoader pattern](https://github.com/graphql/dataloader).

---

## Installation

```
npm i typeorm-graphql-joiner
```

This library is written in TypeScript, so type definitions are included in the box.

Your project must also install the following as peer dependencies (you should have them already):

- [typeorm](https://typeorm.io/) v0.3.x
- [graphql](https://www.npmjs.com/package/graphql) v14.x or higher

Note: typeorm v0.3.0 [changed](https://typeorm.io/changelog#030httpsgithubcomtypeormtypeormpull8616-2022-03-17) the way
relations and data sources work. If you are still using typeorm v0.2.x, please install
[typeorm-graphql-joiner@^1](https://github.com/equalogic/typeorm-graphql-joiner/blob/1.x/README.md) and read the usage
instructions for that version.

---

## Introduction

When your GraphQL server is backed by TypeORM entities, you may have object relationships like the following example:

```
{
  // Product entity
  "product": {
    "id": "1234",
    "name": "Some product",
    // nested Owner entity
    "owner": {
      "id": "4321",
      "name": "Some owner"
    }
  }
}
```

Let's say `product` corresponds to a `Product` entity in TypeORM, and it has a
[many-to-one relationship](https://typeorm.io/#/many-to-one-one-to-many-relations) to an `Owner` entity defined on the
`product.owner` property. In your database, you have a table for each of these entities.

Now you want to expose `Product` as an object in your GraphQL schema with the same relationship. You could simply
resolve `product.owner` using a database query to fetch the related `Owner` object, but if you create a GraphQL resolver
that returns a list of _n_ products then your server will need to perform _n_ + 1 database queries to fully resolve it.
This problem multiplies exponentially as your schema grows more complex and you have levels of nested relationships.

_TypeORM<->GraphQL Joiner_ can help here by optimizing these relationships into SQL `JOIN`s. Instead of fetching the
`product` and then each `owner` individually, it enables you to fetch the `product` with all requested relationships
in a single database query by making use of TypeORM's `relations` [option](https://typeorm.io/#/find-options) on `find`
methods.

So in this simple example, instead of your resolvers producing this SQL:

```sql
SELECT * FROM product;
SELECT * FROM owner WHERE product_id = :x;
SELECT * FROM owner WHERE product_id = :y;
SELECT * FROM owner WHERE product_id = :z;
```

You can optimize it to:

```sql
SELECT * FROM product LEFT JOIN owner ON product.id = owner.product_id;
```

The value of this optimization increases as you have greater levels of nesting, of course.

You could join these relations manually (or eagerly) with TypeORM, but then you are likely to end up overfetching -
retrieving relations that were not requested by the client and producing SQL that is more expensive than necessary.
_TypeORM<->GraphQL Joiner_ only joins relations that were requested in the client's GQL query.

You could also use a [DataLoader](https://github.com/slaypni/type-graphql-dataloader) to batch requests, but this will
usually still result in more database queries than are produced by joining relations. Beware however that large joins
with many levels of nesting can be bad for performance, too, so you may need to mix approaches.

---

## Usage

First, create a `GraphRelationBuilder` instance, passing in a TypeORM `DataSource` object (which provides access to
entity metadata):

```ts
import { GraphRelationBuilder } from 'typeorm-graphql-joiner';
import { dataSource } from './datasource';

const graphRelationBuilder = new GraphRelationBuilder(dataSource);
```

Inside a GraphQL query resolver (where you have a `GraphQLResolveInfo` object available) you can use
`GraphRelationBuilder` to determine the relations you need to join to fulfill the query.

The `build` and `buildForQuery` methods of `GraphRelationBuilder` return a `RelationMap` instance. This is a class
provided by the [typeorm-relations package](https://www.npmjs.com/package/typeorm-relations) and contains methods that
you can use to manipulate the relations before passing them to TypeORM. Read the
[typeorm-relations documentation](https://github.com/equalogic/typeorm-relations#readme) to learn more about it.

### GraphRelationBuilder

#### `buildForQuery(entity: Constructor<Entity>, info: GraphQLResolveInfo): RelationMap<Entity>`

Builds a `RelationMap` for an entity class by mapping from the root of the GraphQL query.

The `entity` passed in should be an entity class constructor (not an instance of the entity).

For example, if you have a `products` query in your GQL schema which returns a list of `Product` entities (where the
`Product` entity and `Product` GQL object type are equivalent), you can simply map `Product` relations in this way:

```ts
import { GraphQLResolveInfo } from 'graphql';
import { dataSource } from './datasource';

// Example resolver function for a "products" query in your GQL schema
function products(source: any, args: any, context: any, info: GraphQLResolveInfo): Promise<Product[]> {
  const graphRelationBuilder = new GraphRelationBuilder(dataSource);

  const productRelationMap = graphRelationBuilder.buildForQuery(Product, info);

  return dataSource.getRepository(Product).find({
    relations: productRelationMap.toFindOptionsRelations(),
  });
}
```

In this example if your `Product` entity has an `owner` property that relates to another entity, and the `owner` field
is selected by the client's GraphQL query, then calling `toFindOptionsRelations()` will produce:

```
{
  owner: true
}
```

Or, if `owner` contains an additional relationship to an `address` entity which is also selected by the client, you can
get a nested structure like:

```
{
  owner: {
    address: true
  }
}
```

#### `buildForQuery(entity: Constructor<Entity>, info: GraphQLResolveInfo, path: string): RelationMap<Entity>`

In some cases you may need to map relations to entity fields where the GQL object type for the entity is not the root
node in the query. A common example of this is in a mutation which returns a payload object containing the modified
object rather than the object directly. In this case you can pass a `path` string as the last argument to
`buildForQuery`:

```ts
import { GraphQLResolveInfo } from 'graphql';
import { dataSource } from './datasource';

// Example resolver function for a "createProduct" mutation in your GQL schema
async function createProduct(
  source: any,
  args: any,
  context: any,
  info: GraphQLResolveInfo,
): Promise<CreateProductPayload> {
  const graphRelationBuilder = new GraphRelationBuilder(dataSource);

  // Create the new product
  const product: Product = await dataSource.getRepository(Product).save(
    dataSource.getRepository(Product).create({
      name: 'New Product',
    }),
  );

  // Create payload and re-fetch the new product to retrieve all requested relations
  const payload: CreateProductPayload = {
    success: true,
    product: await dataSource.getRepository(Product).findOneOrFail({
      where: { id: product.id },
      relations: graphRelationBuilder.buildForQuery(Product, info, 'product').toFindOptionsRelations(),
    }),
  };

  return payload;
}
```

A GraphQL query for this mutation might look like:

```graphql
mutation {
  createProduct {
    success
    product {
      id
      name
      owner {
        id
        name
      }
    }
  }
}
```

The `Product` entity here exists below the root level of the object being resolved (`createProduct`), at a field called
`product`. So the path `'product'` must be given to `buildForQuery`.

Dotted path notation can be used when the entity is at an even lower level in the node tree. For example, the path
`'product.owner'` could be used to map the `Owner` entity in this example.

#### `build(entity: Constructor<Entity>, baseNode: SelectionNode, fragments?: Record<string, FragmentDefinitionNode>): GraphRelationBuilder<Entity>`

This method works like `buildForQuery` (and is called by it internally), but it can operate on an arbitrary
`SelectionNode` rather than requiring an entire `GraphQLResolveInfo` object.

If your GQL for the selection may contain named fragments, the definition of those fragments must be passed through.
The required data can be retrieved from the `fragments` property on the top level `GraphQLResolveInfo` object.

#### `findQueryNode(fieldPath: string, info: GraphQLResolveInfo): SelectionNode | null`

Returns the `SelectionNode` for the referenced field if it was selected in the GQL query represented by `info`. Returns
`null` if the field is not selected by the query.

Nested fields can be located using dotted `'parentField.childField.grandchildField'` notation.

#### `isFieldSelected(fieldPath: string, info: GraphQLResolveInfo): boolean`

Like `findQueryNode` but just returns a boolean indicating whether the referenced field is selected in the GQL query
represented by `info`.

---

## License

MIT
