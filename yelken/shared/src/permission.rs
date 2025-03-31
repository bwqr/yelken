use std::str::FromStr;

#[derive(Clone, Copy)]
pub enum Mode {
    Read,
    Write,
}

#[derive(Clone, Copy)]
pub enum Permission {
    Admin,
    Content(Mode),
    User(Mode),
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Permission::Admin => "admin",
            Permission::Content(Mode::Read) => "content.read",
            Permission::Content(Mode::Write) => "content.write",
            Permission::User(Mode::Read) => "user.read",
            Permission::User(Mode::Write) => "user.write",
        }
    }
}

impl FromStr for Permission {
    type Err = &'static str;

    fn from_str(val: &str) -> Result<Self, Self::Err> {
        let perm = match val {
            "admin" => Permission::Admin,
            "content.read" => Permission::Content(Mode::Read),
            "content.write" => Permission::Content(Mode::Write),
            "user.read" => Permission::User(Mode::Write),
            "user.write" => Permission::User(Mode::Write),
            _ => return Err("unknown permission"),
        };

        Ok(perm)
    }
}
