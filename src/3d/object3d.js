/**
 * @fileOverview Object3d class that represent a object that can be manipulated in a 3d environment.
 * @author Noodep
 * @version 0.34
 */

'use strict';

import {UUIDv4} from '../crypto/uuid.js';
import Mat4 from '../math/mat4.js';
import Quat from '../math/quat.js';
import Vec3 from '../math/vec3.js';
import Listenable from '../util/listenable.js';

/**
 * Object in a 3D environment.
 *
 * Fires the following event types:
 * property:
 *	'origin' - When the origin property updates; passes the new origin
 *	'orientation' - When the orientation property updates; passed the new
 *	orientation
 *	'size' - When the size proprty updates; passes the new size
 *	'model' - When the world model updates; passes the new matrix
 *	'add' - When a child is added; passes this object and the added one
 *	'remove' - When a child is removed; passes this object and the removed one
 *	'destroy' - Directly after destroy() has been called
 * Note that "updates" above does not necessarily imply "changes"; the events
 * will be fired when the property has the possibility of changing.
 */
export default class Object3D extends Listenable {

	/**
	 * @constructor
	 * @memberOf module:3d
	 * @alias Object3d
	 *
	 * @param {String} [id=uuidv4()] - this object id.
	 * @param {Array} [origin] - a 3 dimensional array containing this object origin.
	 * @param {Array} [orientation] - a 3 dimensional array containing this object orientation. Euler angles in radians around XYZ.
	 * @param {Array} [scale] - a 3 dimensional array containing this object scaling.
	 * @return {module:3d.Object3d} - The newly created Object3d.
	 */
	constructor({ id = UUIDv4(), origin = new Vec3(), orientation = Quat.identity(), scale = Vec3.identity() } = {}) {
		super();
		this._id = id;
		this._parent = undefined;
		this._children = new Set();
		this._origin = origin;
		this._orientation = orientation;
		this._scale = scale;
		this._is_model_valid = false;
		this._local_model = Mat4.identity();
		this._world_model = Mat4.identity();

		// Private transformations, applied before the public ones, which are
		// not accessable (directly: they are incorporated into the local and
		// world model matrices) from outside. These transformations are
		// forewarded to children through this._world_model. TODO Create some
		// function/intermediate matrix not containing the private
		// transformations so that, for example, an outside object can get a
		// matrix/transformed vector corresponding to the transformations it can
		// see through the public getters (like Renderer.prototype.toWorldRoot()
		// in the old version of Goblin).
		this._private_origin = new Vec3();
		this._private_orientation = Quat.identity();
		this._private_scale = Vec3.identity();

		// Temporary quaternion used for rotations. This avoids creating one each time.
		this._tmp_quaternion = new Quat();
	}

	/**
	 * Getter for this Object3d id.
	 *
	 * @return {String} - This Object3d id.
	 */
	get id() {
		return this._id;
	}

	/**
	 * Getter for this Object3d parent.
	 *
	 * @return {module:3d.object3d} - This Object3d parent.
	 */
	get parent() {
		return this._parent;
	}

	/**
	 * Setter for this Object3d parent.
	 *
	 * @param {module:3d.object3d} parent - This Object3d new parent.
	 */
	set parent(parent) {
		this._parent = parent;
		this._invalidateModel();
	}

	/**
	 * Getter for the number of children of this Object3D.
	 *
	 * @return {Number} - The number of children of this Object3D.
	 */
	get childCount() {
		return this._children.size;
	}

	/**
	 * Getter for this Object3d origin.
	 *
	 * @return {module:math.Vec3} - This Object3d origin.
	 */
	get origin() {
		return this._origin;
	}

	/**
	 * Setter for this Object3d origin.
	 *
	 * @param {module:math.Vec3} v3 - This Object3d new origin.
	 */
	set origin(v3) {
		this._origin.copy(v3);
		this._invalidateModel();
		this.notify('origin', this._origin);
	}

	/**
	 * Getter for this Object3d orientation.
	 *
	 * @return {module:math.Quat} - This Object3d orientation.
	 */
	get orientation() {
		return this._orientation;
	}

	/**
	 * Setter for this Object3d orientation.
	 *
	 * @param {module:math.Quat} q - This Object3d new orientation.
	 */
	set orientation(q) {
		this._orientation.copy(q);
		this._invalidateModel();
		this.notify('orientation', this._orientation);
	}

	/**
	 * Getter for this Object3d scaling.
	 *
	 * @return {module:math.Vec3} - This Object3d scaling.
	 */
	get size() {
		return this._scale;
	}

	/**
	 * Setter for this Object3d scaling.
	 *
	 * @param {module:math.Vec3} v3 - This Object3d new scaling.
	 */
	set size(v3) {
		this._scale.copy(v3);
		this._invalidateModel();
		this.notify('size', this._scale);
	}

	/**
	 * Getter for this Object3d local model matrix.
	 *
	 * @return {module:math.Mat4} - This Object3d local model matrix.
	 */
	get localModel() {
		this._ensureValidModel();
		return this._local_model;
	}

	/**
	 * Getter for this Object3d world model matrix.
	 *
	 * @return {module:math.Mat4} - This Object3d world model matrix.
	 */
	get worldModel() {
		this._ensureValidModel();
		return this._world_model;
	}

	/**
	 * Getter for this Object3d private origin.
	 *
	 * @return {module:math.Vec3} - This Object3d private origin.
	 */
	get _privateOrigin() {
		return this._private_origin;
	}

	/**
	 * Setter for this Object3d private origin.
	 *
	 * @param {module:math.Vec3} v3 - This Object3d new private origin.
	 */
	set _privateOrigin(v3) {
		this._private_origin.copy(v3);
		this._invalidateModel();
	}

	/**
	 * Getter for this Object3d private orientation.
	 *
	 * @return {module:math.Quat} - This Object3d private orientation.
	 */
	get _privateOrientation() {
		return this._private_orientation;
	}

	/**
	 * Setter for this Object3d private orientation.
	 *
	 * @param {module:math.Quat} q - This Object3d new private orientation.
	 */
	set _privateOrientation(q) {
		this._private_orientation.copy(q);
		this._invalidateModel();
	}

	/**
	 * Getter for this Object3d private scaling.
	 *
	 * @return {module:math.Vec3} - This Object3d private scaling.
	 */
	get _privateScale() {
		return this._private_scale;
	}

	/**
	 * Setter for this Object3d private scaling.
	 *
	 * @param {module:math.Vec3} v3 - This Object3d new private scaling.
	 */
	set _privateScale(v3) {
		this._private_scale.copy(v3);
		this._invalidateModel();
	}


	/**
	 * Adds a child to this Object3d
	 *
	 * @param {module:3d.Object3d} object - The Object3d to be added as a child.
	 */
	addChild(object) {
		if(object.parent)
			throw new Error('Unable to add the specified object to this node as it already has a parent.');

		if (this.hasChild(object)) {
			wl(`Object ${object.id} is already a child of this object.`);
			return;
		}

		this._children.add(object);
		object.parent = this;

		this.notify('add', this, object);
	}

	/**
	 * Tests whether or not the specified object is a child of this object.
	 *
	 * @param {Object3D} object - The object to search for as a child.
	 * @return {Boolean} - true if the object is a child of this object; false
	 * otherwise.
	 */
	hasChild(object) {
		return this._children.has(object);
	}

	/**
	 * Returns an iterator over the children of this Object3D.
	 */
	getChildren() {
		return this._children.values();
	}

	/**
	 * Removes a child from this Object3d if possible.
	 *
	 * @param {module:3d.Object3d} object - The Object3d to be removed.
	 * @return {Boolean} - true if the object was removed, false if the object
	 * was not a child of this Object3d.
	 */
	removeChild(object) {
		if(!object || !this.hasChild(object)) {
			wl(`Object ${object} is not a child of this object.`);
			return false;
		}

		this._children.delete(object);
		object.parent = undefined;
		this.notify('remove', this, object);
		return true;
	}

	/**
	 * Removes all children from this Object3D.
	 */
	clearChildren() {
		for (let child of this._children) {
			this.removeChild(child);
		}
	}

	/**
	 * Updates this object model matrix.
	 */
	update() {
		this._ensureValidModel();
		for(let child of this._children)
			child.update();
	}

	/**
	 * Scales this Object3d by the specified vector.
	 *
	 * @param {module:math.Vec3} v - The vector by which to translate this Object3d.
	 */
	scale(v) {
		this._scale.multiply(v);
		this._invalidateModel();
		this.notify('size', this._scale);
	}

	/**
	 * Translates this Object3d by the specified vector.
	 *
	 * @param {module:math.Vec3} v - The vector by which to translate this Object3d.
	 */
	translate(v) {
		this._origin.add(v);
		this._invalidateModel();
		this.notify('origin', this._origin);
	}

	/**
	 * Translates this Object3d along its X axis.
	 *
	 * @param {Number} delta_x - the amount by which to translate this Object3d.
	 */
	translateX(delta_x) {
		this._origin.translateX(delta_x);
		this._invalidateModel();
		this.notify('origin', this._origin);
	}

	/**
	 * Translates this Object3d along its Y axis.
	 *
	 * @param {Number} delta_y - the amount by which to translate this Object3d.
	 */
	translateY(delta_y) {
		this._origin.translateY(delta_y);
		this._invalidateModel();
		this.notify('origin', this._origin);
	}

	/**
	 * Translates this Object3d along its Z axis.
	 *
	 * @param {Number} delta_z - the amount by which to translate this Object3d.
	 */
	translateZ(delta_z) {
		this._origin.translateZ(delta_z);
		this._invalidateModel();
		this.notify('origin', this._origin);
	}

	/**
	 * Applies a rotation around the specified axis to this object.
	 *
	 * @param {Number} theta - The angle (in radians) by which to rotate.
	 * @param {module:math.Vec3} axis - The axis to rotate around.
	 * @return {module:3d.object3d} - The rotated object.
	 */
	rotate(theta, axis) {
		this._tmp_quaternion.fromAxisRotation(theta, axis);
		this._orientation.multiply(this._tmp_quaternion);
		this._invalidateModel();
		this.notify('orientation', this._orientation);
	}

	/**
	 * Applies a rotation in R3 around the X axis to this object.
	 *
	 * @param {Number} theta - Angle in radians by which to rotate.
	 */
	rotateX(theta) {
		this._tmp_quaternion.fromAxisRotation(theta, Vec3.X_AXIS);
		this._orientation.multiply(this._tmp_quaternion);
		this._invalidateModel();
		this.notify('orientation', this._orientation);
	}

	/**
	 * Applies a rotation in R3 around the Y axis to this object.
	 *
	 * @param {Number} theta - Angle in radians by which to rotate.
	 */
	rotateY(theta) {
		this._tmp_quaternion.fromAxisRotation(theta, Vec3.Y_AXIS);
		this._orientation.multiply(this._tmp_quaternion);
		this._invalidateModel();
		return this;
	}

	/**
	 * Applies a rotation in R3 around the Z axis to this object.
	 *
	 * @param {Number} theta - Angle in radians by which to rotate.
	 */
	rotateZ(theta) {
		this._tmp_quaternion.fromAxisRotation(theta, Vec3.Z_AXIS);
		this._orientation.multiply(this._tmp_quaternion);
		this._invalidateModel();
		return this;
	}

	/**
	 * Removes this Object3D from the hierarchy and removes its event listeners.
	 */
	destroy() {
		if (this.parent) {
			this.parent.removeChild(this);
		}

		this.clearListeners();

		for (let child of this._children) {
			this.removeChild(child);
			child.destroy();
		}

		this.notify('destroy');
	}

	/**
	 * Ensures that the model matrix is up-to-date with all parameters of this
	 * obejct and of all of its ancestors.
	 */
	_ensureValidModel() {
		if (this._parent) {
			this._parent._ensureValidModel();
		}

		if (!this._is_model_valid) {
			this._revalidateModel();
		}
	}

	/**
	 * Invalidates this object model matrix.
	 * An invalid matrix will be recomputed during the next update.
	 */
	_invalidateModel() {
		this._is_model_valid = false;
	}

	/**
	 * Recomputes this object model matrix.
	 */
	_revalidateModel() {
		this._local_model.identity();
		this._local_model.translate(this._origin);
		this._local_model.rotateQuat(this._orientation);
		this._local_model.scaleVec(this._scale);

		this._local_model.translate(this._private_origin);
		this._local_model.rotateQuat(this._private_orientation);
		this._local_model.scaleVec(this._private_scale);

		this._computeWorldModel();
		this._is_model_valid = true;

		for(let child of this._children)
			child._invalidateModel();

		this.notify('model', this.worldModel);
	}

	/**
	 * Computes this object world matrix based on the local model and this object parent world matrix.
	 */
	_computeWorldModel() {
		if(this._parent) {
			this._world_model.copy(this._parent.worldModel);
			this._world_model.multiply(this._local_model);
		} else {
			this._world_model.copy(this._local_model);
		}
	}

}

