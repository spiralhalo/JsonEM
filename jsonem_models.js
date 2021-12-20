(function() {

const CODEC = new Codec("jsonem_entity", {
    name: "JsonEM Entity",
    load_filter: {
        extensions: ["json"],
        type: "json"
    },
    extension: "json",
    remember: true,
    parse(model, path) {
        JSON.stringify(model); // This makes it work for some reason don't question

        let texture = model["texture"];
        let bones = model["bones"];

        Project.texture_width = texture["width"];
        Project.texture_height = texture["height"];

        for (key in bones) {
            addBone(undefined, [0, 0, 0], key, bones[key]);
        }
    },
    compile() {
        let compiled = {};

        compiled.texture = {};
        compiled.texture.width = Project.texture_width;
        compiled.texture.height = Project.texture_height;

        compiled.bones = {};
        for (node of Outliner.root) {
            if (node instanceof Group) {
                compiled.bones[node.name] = compileBone(node);
            }
        }

        console.log(JSON.stringify(compiled))

        return JSON.stringify(compiled, null, 4);
    },
    export_action: new Action("export_jsonem", {
        name: "Export JsonEM Java Entity Model",
        icon: "icon-format_java",
        category: "file",
        click: () => CODEC.export()
    })
});

const FORMAT = new ModelFormat({
    id: "jsonem_model",
    icon: "icon-format_java",
    name: "JsonEM Java Entity Model",
    description: "Entity model for Minecraft Java Edition through JsonEM.",
    show_on_start_screen: true,
    box_uv: true,
    optional_box_uv: false,
    single_texture: true,
    bone_rig: true,
    centered_grid: true,
    rotate_cubes: true,
    integer_size: false,
    locators: false,
    canvas_limit: false,
    rotation_limit: false,
    display_mode: true,
    animation_mode: false,
    codec: CODEC,
    onActivation() {
        MenuBar.addAction(CODEC.export_action, "file.export")
    },
    onDeactivation() {
        CODEC.export_action.delete();
        CODEC.delete();
    }
})

Plugin.register("jsonem_models", {
    title: "JsonEM Model Support",
    author: "FoundationGames",
    description: "Create models to be used with https://github.com/FoundationGames/JsonEM",
    icon: "icon-format_java",
    version: "1.0",
    variant: "both"
})

function flipY(vec) {
    return [vec[0], -vec[1], vec[2]];
}

function isZero(vec) {
    for (c of vec) {
        if (c != 0) {
            return false;
        }
    }
    return true;
}

function addBone(parent, origin, key, bone) {
    let gopts = {name: key, children: []};

    if ("transform" in bone) {
        if ("origin" in bone.transform) {
            let bor = bone.transform.origin;
            origin = [origin[0] + bor[0], origin[1] + bor[1], origin[2] + bor[2]];

            gopts.origin = flipY(origin);
        }
        if ("rotation" in bone.transform) {
            let rot = bone.transform.rotation;
            gopts.rotation = [-Math.radToDeg(rot[0]), Math.radToDeg(rot[1]), -Math.radToDeg(rot[2])];
        }
    }

    let group = new Group(gopts);

    if (parent !== undefined) {
        group.addTo(parent);
    }

    group = group.init();

    for (cuboid of bone.cuboids) {
        let copts = {name: "cube"};

        if ("name" in cuboid) {
            copts.name = cuboid["name"];
        }
        if ("dilation" in cuboid) {
            copts.inflate = cuboid["dilation"];
        }
        if ("mirror" in cuboid) {
            copts.mirror_uv = cuboid["mirror"];
        }
        
        let pos = cuboid["offset"];
        pos = [pos[0] + origin[0], pos[1] + origin[1], pos[2] + origin[2]]
        let size = cuboid["dimensions"];
        copts.from = flipY([pos[0], pos[1] + size[1], pos[2]]);
        copts.to = flipY([pos[0] + size[0], pos[1], pos[2] + size[2]]);

        copts.uv_offset = cuboid["uv"];

        new Cube(copts).addTo(group).init();
    }

    for (ckey in bone["children"]) {
        addBone(group, origin, ckey, bone["children"][ckey]);
    }
}

function compileBone(bone) {
    let compiled = {};


    let origin = flipY(bone.origin);
    if (!isZero(origin)) {
        if (!("transform" in compiled)) compiled.transform = {};
        compiled.transform.origin = origin;
    }

    let brot = bone.rotation;
    let rotation = [Math.degToRad(-brot[0]), Math.degToRad(brot[1]), Math.degToRad(-brot[2])];
    if (!isZero(rotation)) {
        if (!("transform" in compiled)) compiled.transform = {};
        compiled.transform.rotation = rotation;
    }

    compiled.cuboids = [];

    let children = {}
    for (node of bone.children) {
        if (node instanceof Group) {
            children[node.name] = compileBone(node);
        }
        if (node instanceof Cube) {
            let cuboid = {}

            if (node.name !== "cube") {
                cuboid.name = node.name;
            }

            let to = node.to;
            let from = node.from;
            let size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
            cuboid.offset = flipY([from[0], from[1] + size[1], from[2]]);
            cuboid.dimensions = size;
            cuboid.uv = node.uv_offset;

            if (node.mirror_uv) {
                cuboid.mirror = true;
            }
            if (node.inflate > 0) {
                cuboid.dilation = node.inflate;
            }
            
            compiled.cuboids.push(cuboid);
        }
    }
    if (bone.children.length > 0) {
        compiled.children = children;
    }

    return compiled;
}

})();