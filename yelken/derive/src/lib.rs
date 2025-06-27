use proc_macro::TokenStream;
use proc_macro2::Ident;
use quote::quote;
use syn::{DeriveInput, Meta, parse_macro_input};

#[proc_macro_derive(Sanitize, attributes(sanitize))]
pub fn sanitize_derive(input: TokenStream) -> TokenStream {
    // Construct a representation of Rust code as a syntax tree
    // that we can manipulate
    let ast = parse_macro_input!(input as DeriveInput);

    // Build the trait implementation
    impl_sanitize(&ast).into()
}

fn impl_sanitize(ast: &DeriveInput) -> TokenStream {
    // Ensure the macro is on a struct with named fields
    let fields = match ast.data {
        syn::Data::Struct(syn::DataStruct { ref fields, .. }) => {
            if fields.iter().any(|field| field.ident.is_none()) {
                panic!("invalid field, struct with named fields");
            }
            fields.iter().cloned().collect::<Vec<_>>()
        }
        _ => panic!("invalid field, struct with named fields"),
    };

    let mut sanitize_fields = vec![];

    for field in fields {
        let field_ident = field.ident.clone().unwrap();

        let mut skip = false;

        for attr in field.attrs {
            if attr.path().is_ident("sanitize") {
                let Meta::List(list) = attr.meta else {
                    panic!("Unknown attribute meta");
                };

                let literal = list.parse_args::<Ident>().unwrap();

                if literal.to_string() == "skip" {
                    skip = true;
                }
            }
        }

        if skip {
            sanitize_fields.push(quote! {
                #field_ident: self.#field_ident,
            });
        } else {
            sanitize_fields.push(quote! {
                #field_ident: self.#field_ident.sanitize(),
            });
        }
    }

    let name = &ast.ident;

    let tokens = quote! {
        impl Sanitize for #name {
            fn sanitize(mut self) -> Self {
               #name {
                #(#sanitize_fields)*
               }
            }
        }
    };

    TokenStream::from(tokens)
}
